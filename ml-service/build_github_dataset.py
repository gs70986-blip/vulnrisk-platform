"""
构建 GitHub 训练负类数据脚本
从 ../data/github_corpus_issues_prs.jsonl 生成可训练的 CSV 文件

用法:
    python build_github_dataset.py

输出:
    ../data/github_issues_prs_clean.csv
    ../data/github_issues_prs_clean_summary.json
"""

import json
import csv
import re
import hashlib
from pathlib import Path
from typing import Dict, List, Any

# ========== 可配置常量 ==========
MIN_TEXT_LENGTH = 20  # 最小文本长度（可调整）
SYMBOL_RATIO_THRESHOLD = 0.35  # 符号/代码字符比例阈值（可调整）
MAX_COMMENTS_LENGTH = 2000  # 评论部分最大长度（避免过长）


def remove_markdown_code_blocks(text: str) -> str:
    """
    移除 Markdown 代码块
    
    Args:
        text: 原始文本
    
    Returns:
        清理后的文本
    """
    # 移除代码块: ```...```
    text = re.sub(r'```[\s\S]*?```', '', text)
    # 移除行内代码: `...`
    text = re.sub(r'`[^`]+`', '', text)
    return text


def calculate_symbol_ratio(text: str) -> float:
    """
    计算符号/代码字符比例
    
    统计非字母数字空白字符（包括 { } ; < > = + - * / 等）的比例
    
    Args:
        text: 输入文本
    
    Returns:
        符号比例 [0, 1]
    """
    if not text:
        return 0.0
    
    # 定义符号字符（代码相关）
    symbol_chars = set('{}[]();<>=\\+-*/%&|!~^@#$`')
    
    total_chars = len(text)
    symbol_count = sum(1 for c in text if c in symbol_chars)
    
    return symbol_count / total_chars if total_chars > 0 else 0.0


def is_code_diff_text(text: str) -> bool:
    """
    判断文本是否主要是代码/diff
    
    Args:
        text: 输入文本
    
    Returns:
        True 如果是代码/diff为主
    """
    text_lower = text.lower()
    
    # 检查是否包含 diff 标记
    if 'diff --git' in text_lower or '@@' in text:
        return True
    
    # 检查符号比例
    symbol_ratio = calculate_symbol_ratio(text)
    if symbol_ratio > SYMBOL_RATIO_THRESHOLD:
        return True
    
    return False


def construct_text(entry: Dict[str, Any]) -> str:
    """
    构造训练文本
    
    规则: text = (title or "") + "\n\n" + (body or "") + "\n\n" + (comments or "")
    
    Args:
        entry: JSONL 条目
    
    Returns:
        拼接后的文本
    """
    title = entry.get('title', '') or ''
    body = entry.get('body', '') or ''
    comments = entry.get('comments', [])
    
    # 拼接评论（限制长度）
    comments_text = ''
    if comments:
        comments_list = []
        total_length = 0
        for comment in comments:
            comment_body = comment.get('body', '') or ''
            if total_length + len(comment_body) > MAX_COMMENTS_LENGTH:
                break
            comments_list.append(comment_body)
            total_length += len(comment_body)
        comments_text = '\n\n'.join(comments_list)
    
    # 拼接文本
    parts = []
    if title:
        parts.append(title)
    if body:
        parts.append(body)
    if comments_text:
        parts.append(comments_text)
    
    text = '\n\n'.join(parts)
    return text


def clean_text(text: str) -> str:
    """
    清洗文本
    
    Args:
        text: 原始文本
    
    Returns:
        清洗后的文本
    """
    # 移除 Markdown 代码块
    text = remove_markdown_code_blocks(text)
    
    # 移除多余的空白
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text


def sha1_hash(text: str) -> str:
    """
    计算文本的 SHA1 哈希值（用于去重）
    
    Args:
        text: 输入文本
    
    Returns:
        SHA1 哈希值（十六进制字符串）
    """
    return hashlib.sha1(text.encode('utf-8')).hexdigest()


def build_github_dataset():
    """
    主函数：构建 GitHub 训练数据集
    """
    print('=' * 60)
    print('构建 GitHub 训练负类数据')
    print('=' * 60)
    
    # 路径配置
    input_path = Path(__file__).parent.parent / 'data' / 'github_corpus_issues_prs.jsonl'
    output_csv_path = Path(__file__).parent.parent / 'data' / 'github_issues_prs_clean.csv'
    output_summary_path = Path(__file__).parent.parent / 'data' / 'github_issues_prs_clean_summary.json'
    
    # 确保输出目录存在
    output_csv_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f'\n输入文件: {input_path}')
    print(f'输出CSV: {output_csv_path}')
    print(f'输出摘要: {output_summary_path}')
    
    # 统计信息
    stats = {
        'raw_count': 0,
        'kept_count': 0,
        'deduped_count': 0,
        'filtered_by_length': 0,
        'filtered_by_code_diff': 0,
        'deduped_by_url': 0,
        'deduped_by_hash': 0,
        'text_lengths': [],
        'final_thresholds': {
            'min_text_length': MIN_TEXT_LENGTH,
            'symbol_ratio_threshold': SYMBOL_RATIO_THRESHOLD,
        }
    }
    
    # 去重集合
    seen_urls = set()
    seen_hashes = set()
    
    # 存储清理后的数据
    clean_entries = []
    
    print(f'\n开始处理 JSONL 文件...')
    print(f'配置:')
    print(f'  最小文本长度: {MIN_TEXT_LENGTH}')
    print(f'  符号比例阈值: {SYMBOL_RATIO_THRESHOLD}')
    
    # 读取 JSONL 文件
    if not input_path.exists():
        raise FileNotFoundError(f'输入文件不存在: {input_path}')
    
    with open(input_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            if not line.strip():
                continue
            
            try:
                entry = json.loads(line)
                stats['raw_count'] += 1
                
                # 构造文本
                raw_text = construct_text(entry)
                
                # 清洗文本
                cleaned_text = clean_text(raw_text)
                
                # 过滤：长度检查
                if len(cleaned_text) < MIN_TEXT_LENGTH:
                    stats['filtered_by_length'] += 1
                    continue
                
                # 过滤：代码/diff 检查
                if is_code_diff_text(cleaned_text):
                    stats['filtered_by_code_diff'] += 1
                    continue
                
                # 去重：优先使用 URL
                url = entry.get('url', '')
                if url:
                    if url in seen_urls:
                        stats['deduped_by_url'] += 1
                        continue
                    seen_urls.add(url)
                else:
                    # 如果没有 URL，使用文本哈希
                    text_hash = sha1_hash(cleaned_text)
                    if text_hash in seen_hashes:
                        stats['deduped_by_hash'] += 1
                        continue
                    seen_hashes.add(text_hash)
                
                # 保存清理后的条目
                clean_entry = {
                    'id': entry.get('id', ''),
                    'owner': entry.get('owner', ''),
                    'repo': entry.get('repo', ''),
                    'type': entry.get('type', ''),
                    'url': url,
                    'text': cleaned_text,
                }
                clean_entries.append(clean_entry)
                stats['kept_count'] += 1
                stats['text_lengths'].append(len(cleaned_text))
                
                if line_num % 100 == 0:
                    print(f'  已处理 {line_num} 行，保留 {stats["kept_count"]} 条')
                
            except json.JSONDecodeError as e:
                print(f'警告: 第 {line_num} 行 JSON 解析失败: {e}')
                continue
            except Exception as e:
                print(f'警告: 第 {line_num} 行处理失败: {e}')
                continue
    
    # 计算统计信息
    stats['deduped_count'] = stats['deduped_by_url'] + stats['deduped_by_hash']
    
    if stats['text_lengths']:
        stats['avg_len'] = sum(stats['text_lengths']) / len(stats['text_lengths'])
        stats['min_len'] = min(stats['text_lengths'])
        stats['max_len'] = max(stats['text_lengths'])
    else:
        stats['avg_len'] = 0
        stats['min_len'] = 0
        stats['max_len'] = 0
    
    # 写入 CSV 文件
    print(f'\n写入 CSV 文件...')
    with open(output_csv_path, 'w', encoding='utf-8', newline='') as f:
        if clean_entries:
            writer = csv.DictWriter(f, fieldnames=['id', 'owner', 'repo', 'type', 'url', 'text'])
            writer.writeheader()
            writer.writerows(clean_entries)
    
    # 写入摘要文件
    summary = {
        'raw_count': stats['raw_count'],
        'kept_count': stats['kept_count'],
        'deduped_count': stats['deduped_count'],
        'filtered_by_length': stats['filtered_by_length'],
        'filtered_by_code_diff': stats['filtered_by_code_diff'],
        'deduped_by_url': stats['deduped_by_url'],
        'deduped_by_hash': stats['deduped_by_hash'],
        'avg_len': round(stats['avg_len'], 2),
        'min_len': stats['min_len'],
        'max_len': stats['max_len'],
        'final_thresholds': stats['final_thresholds'],
    }
    
    with open(output_summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    # 输出统计信息
    print('\n' + '=' * 60)
    print('处理完成')
    print('=' * 60)
    print(f'\n统计信息:')
    print(f'  原始行数: {stats["raw_count"]}')
    print(f'  保留行数: {stats["kept_count"]}')
    print(f'  去重数量: {stats["deduped_count"]} (URL: {stats["deduped_by_url"]}, Hash: {stats["deduped_by_hash"]})')
    print(f'  长度过滤: {stats["filtered_by_length"]}')
    print(f'  代码过滤: {stats["filtered_by_code_diff"]}')
    print(f'\n文本长度统计:')
    print(f'  平均长度: {stats["avg_len"]:.2f} 字符')
    print(f'  最小长度: {stats["min_len"]} 字符')
    print(f'  最大长度: {stats["max_len"]} 字符')
    print(f'\n输出文件:')
    print(f'  CSV: {output_csv_path}')
    print(f'  摘要: {output_summary_path}')
    
    # 验收检查（仅作为信息提示，不阻止流程）
    print('\n' + '=' * 60)
    print('数据统计')
    print('=' * 60)
    
    if stats['kept_count'] >= 2000:
        print(f'[INFO] 保留行数: {stats["kept_count"]} (>= 2000，推荐)')
    else:
        print(f'[INFO] 保留行数: {stats["kept_count"]} (< 2000，数据量较少但可继续)')
        print(f'\n提示（可选优化）:')
        print(f'  1. 降低最小文本长度阈值（当前: {MIN_TEXT_LENGTH}）')
        print(f'  2. 提高符号比例阈值（当前: {SYMBOL_RATIO_THRESHOLD}）')
        print(f'  3. 增加输入数据源')
    
    # 始终返回成功，不阻止流程
    return True


if __name__ == '__main__':
    try:
        build_github_dataset()
        print('\n[SUCCESS] GitHub数据构建完成')
    except Exception as e:
        print(f'\n[ERROR] 错误: {e}')
        import traceback
        traceback.print_exc()
        exit(1)

