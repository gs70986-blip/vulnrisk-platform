"""
生成增强负类数据集
用于Stage A模型鲁棒性训练

生成三个负类子集：
1. neg_noise.csv - 噪声/闲聊/日志类文本
2. neg_keyword_only.csv - 仅包含安全关键词但无上下文的文本
3. neg_patch_mitigation.csv - 补丁/缓解风格文本
"""

import pandas as pd
import random
import numpy as np
from pathlib import Path
import json

# 固定随机种子以确保可重现性
RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

# 输出目录
OUTPUT_DIR = Path(__file__).parent / 'data_aug'
OUTPUT_DIR.mkdir(exist_ok=True)


def generate_noise_samples(n_samples=1200):
    """生成噪声/闲聊/日志类文本"""
    samples = []
    
    # 问候语和闲聊
    greetings = [
        "hello hello, nice to meet you",
        "hi there, how are you doing today",
        "good morning, hope you have a great day",
        "thanks for your help, really appreciate it",
        "nice to meet you, have a wonderful day",
        "hello world, this is a test message",
        "hi everyone, just checking in",
        "good day to you all",
        "thank you very much for your time",
        "hello hello hello, testing testing",
    ]
    
    # 随机句子
    random_sentences = [
        "the quick brown fox jumps over the lazy dog",
        "today is a beautiful day outside",
        "i am working on some code right now",
        "this is just a random sentence here",
        "testing one two three four five",
        "sample text for demonstration purposes",
        "random words in a sentence format",
        "another example of generic text content",
        "placeholder text for testing scenarios",
        "generic developer chatter and comments",
    ]
    
    # 重复token模式
    repeated_patterns = [
        "test test test test test",
        "hello hello hello hello",
        "error error error error",
        "debug debug debug debug",
        "fix fix fix fix fix",
        "update update update update",
        "check check check check",
    ]
    
    # Lorem ipsum片段
    lorem_samples = [
        "lorem ipsum dolor sit amet consectetur adipiscing elit",
        "sed do eiusmod tempor incididunt ut labore et dolore",
        "magna aliqua ut enim ad minim veniam quis nostrud",
        "exercitation ullamco laboris nisi ut aliquip ex ea",
        "commodo consequat duis aute irure dolor in reprehenderit",
    ]
    
    # 日志片段
    log_samples = [
        "INFO: application started successfully",
        "DEBUG: processing request with id 12345",
        "WARNING: connection timeout occurred",
        "ERROR: failed to load configuration file",
        "TRACE: entering function process_data",
        "LOG: user login attempt from ip address",
        "INFO: database connection established",
        "DEBUG: cache hit for key user_123",
    ]
    
    # 堆栈跟踪样文本
    stacktrace_samples = [
        "exception in thread main java lang nullpointerexception",
        "at com example service process line 123",
        "caused by java io ioexception file not found",
        "traceback most recent call last file main py",
        "error occurred at function call with parameters",
    ]
    
    all_templates = greetings + random_sentences + repeated_patterns + lorem_samples + log_samples + stacktrace_samples
    
    # 生成变体
    for i in range(n_samples):
        base = random.choice(all_templates)
        
        # 添加一些变体
        if random.random() < 0.3:
            # 添加重复
            base = base + " " + base.split()[0] if base.split() else base
        if random.random() < 0.2:
            # 添加数字
            base = base + " " + str(random.randint(1, 1000))
        if random.random() < 0.2:
            # 改变大小写
            base = base.upper() if random.random() < 0.5 else base.lower()
        
        samples.append({
            'text': base,
            'label': 0,
            'subclass': 'noise'
        })
    
    return samples


def generate_keyword_only_samples(n_samples=1200):
    """生成仅包含安全关键词但无上下文的文本"""
    samples = []
    
    # 安全关键词列表
    security_keywords = [
        'xss', 'cross site scripting', 'sqli', 'sql injection',
        'csrf', 'ssrf', 'rce', 'remote code execution',
        'command injection', 'buffer overflow', 'stack overflow',
        'path traversal', 'directory traversal',
        'deserialization', 'xxe', 'xml external entity',
        'authentication bypass', 'authorization bypass',
        'privilege escalation', 'information disclosure',
        'open redirect', 'clickjacking', 'session fixation',
        'cors misconfiguration', 'jwt', 'hardcoded secret',
    ]
    
    # 正常句子模板（无exploit/impact上下文）
    benign_templates = [
        "today is a good day {keyword}",
        "this is a test for {keyword}",
        "checking {keyword} functionality",
        "working on {keyword} implementation",
        "reviewing {keyword} code changes",
        "discussing {keyword} in meeting",
        "learning about {keyword} concepts",
        "reading documentation about {keyword}",
        "planning {keyword} feature development",
        "considering {keyword} as option",
        "{keyword} test case",
        "{keyword} example code",
        "{keyword} tutorial guide",
        "{keyword} best practices",
        "{keyword} reference material",
    ]
    
    # 标题/口号形式
    title_templates = [
        "{keyword}",
        "{keyword} test",
        "{keyword} example",
        "{keyword} demo",
        "introduction to {keyword}",
        "overview of {keyword}",
        "{keyword} basics",
        "{keyword} fundamentals",
    ]
    
    # 混合大小写变体
    case_variants = [
        lambda s: s.upper(),
        lambda s: s.lower(),
        lambda s: s.capitalize(),
        lambda s: ''.join(c.upper() if i % 2 == 0 else c.lower() for i, c in enumerate(s)),
    ]
    
    all_templates = benign_templates + title_templates
    
    for i in range(n_samples):
        keyword = random.choice(security_keywords)
        template = random.choice(all_templates)
        text = template.format(keyword=keyword)
        
        # 随机应用大小写变体
        if random.random() < 0.3:
            variant_func = random.choice(case_variants)
            text = variant_func(text)
        
        # 有时添加无关词
        if random.random() < 0.2:
            extra_words = ['hello', 'test', 'sample', 'demo', 'example', 'check']
            text = text + " " + random.choice(extra_words)
        
        samples.append({
            'text': text,
            'label': 0,
            'subclass': 'keyword_only'
        })
    
    return samples


def generate_patch_mitigation_samples(n_samples=1200):
    """生成补丁/缓解风格文本"""
    samples = []
    
    # 补丁动词
    patch_verbs = [
        'fix', 'fixed', 'patch', 'patched', 'prevent', 'prevented',
        'mitigate', 'mitigated', 'sanitize', 'sanitized',
        'escape', 'escaped', 'validate', 'validated',
        'secure', 'secured', 'harden', 'hardened',
        'block', 'blocked', 'filter', 'filtered',
        'reject', 'rejected', 'whitelist', 'blacklist',
    ]
    
    # 前缀
    prefixes = [
        'Fix:', 'Patch:', 'Hotfix:', 'Security:', 'Bugfix:',
        'Fix', 'Patch', 'Hotfix', 'Security', 'Bugfix',
    ]
    
    # 模板
    templates = [
        "{prefix} {verb} {issue} by {action}",
        "{prefix} {verb} {issue} through {action}",
        "{prefix} {verb} {issue} using {action}",
        "{prefix} {verb} {issue} with {action}",
        "{prefix} {verb} {issue}",
        "{prefix} {verb} potential {issue}",
        "{prefix} {verb} {issue} to prevent {consequence}",
        "{prefix} added {action} to {verb} {issue}",
        "{prefix} implemented {action} to {verb} {issue}",
        "{prefix} {verb} {issue} via {action}",
    ]
    
    # 问题类型
    issues = [
        'command injection', 'sql injection', 'xss', 'csrf',
        'path traversal', 'buffer overflow', 'rce', 'xxe',
        'authentication bypass', 'information disclosure',
        'privilege escalation', 'open redirect',
    ]
    
    # 动作
    actions = [
        'input sanitization', 'input validation', 'input escaping',
        'parameterized queries', 'output encoding', 'csrf tokens',
        'access control checks', 'input filtering', 'whitelist validation',
        'secure coding practices', 'defense in depth', 'secure defaults',
    ]
    
    # 后果
    consequences = [
        'unauthorized access', 'code execution', 'data leakage',
        'privilege escalation', 'information disclosure', 'system compromise',
    ]
    
    for i in range(n_samples):
        prefix = random.choice(prefixes) if random.random() < 0.6 else ""
        verb = random.choice(patch_verbs)
        issue = random.choice(issues)
        action = random.choice(actions)
        consequence = random.choice(consequences)
        
        template = random.choice(templates)
        text = template.format(
            prefix=prefix,
            verb=verb,
            issue=issue,
            action=action,
            consequence=consequence
        )
        
        # 清理多余空格
        text = ' '.join(text.split())
        
        samples.append({
            'text': text,
            'label': 0,
            'subclass': 'patch_mitigation'
        })
    
    return samples


def main():
    """主函数"""
    print("=" * 60)
    print("生成增强负类数据集")
    print("=" * 60)
    
    # 生成三个数据集
    print("\n生成噪声数据集...")
    noise_samples = generate_noise_samples(1200)
    df_noise = pd.DataFrame(noise_samples)
    noise_path = OUTPUT_DIR / 'neg_noise.csv'
    df_noise[['text', 'label']].to_csv(noise_path, index=False)
    print(f"  已生成 {len(df_noise)} 条噪声样本 -> {noise_path}")
    
    print("\n生成关键词仅数据集...")
    keyword_samples = generate_keyword_only_samples(1200)
    df_keyword = pd.DataFrame(keyword_samples)
    keyword_path = OUTPUT_DIR / 'neg_keyword_only.csv'
    df_keyword[['text', 'label']].to_csv(keyword_path, index=False)
    print(f"  已生成 {len(df_keyword)} 条关键词仅样本 -> {keyword_path}")
    
    print("\n生成补丁/缓解数据集...")
    patch_samples = generate_patch_mitigation_samples(1200)
    df_patch = pd.DataFrame(patch_samples)
    patch_path = OUTPUT_DIR / 'neg_patch_mitigation.csv'
    df_patch[['text', 'label']].to_csv(patch_path, index=False)
    print(f"  已生成 {len(df_patch)} 条补丁/缓解样本 -> {patch_path}")
    
    # 保存统计信息
    stats = {
        'random_seed': RANDOM_SEED,
        'generation_date': pd.Timestamp.now().isoformat(),
        'datasets': {
            'neg_noise': {
                'count': len(df_noise),
                'file': str(noise_path),
            },
            'neg_keyword_only': {
                'count': len(df_keyword),
                'file': str(keyword_path),
            },
            'neg_patch_mitigation': {
                'count': len(df_patch),
                'file': str(patch_path),
            },
        },
        'total_samples': len(df_noise) + len(df_keyword) + len(df_patch),
    }
    
    stats_path = OUTPUT_DIR / 'generation_stats.json'
    with open(stats_path, 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    
    # 创建README
    readme_content = f"""# 增强负类数据集

## 生成信息

- **随机种子**: {RANDOM_SEED}
- **生成日期**: {stats['generation_date']}
- **总样本数**: {stats['total_samples']}

## 数据集说明

### 1. neg_noise.csv
- **样本数**: {len(df_noise)}
- **描述**: 噪声/闲聊/日志类文本
- **包含**: 问候语、随机句子、重复token、lorem ipsum、日志片段、堆栈跟踪样文本

### 2. neg_keyword_only.csv
- **样本数**: {len(df_keyword)}
- **描述**: 仅包含安全关键词但无exploit/impact上下文的文本
- **包含**: 正常句子中插入安全关键词、标题/口号形式、混合大小写变体

### 3. neg_patch_mitigation.csv
- **样本数**: {len(df_patch)}
- **描述**: 补丁/缓解风格文本
- **包含**: 修复/缓解动词、commit/PR前缀、防御性措施描述

## 使用说明

这些数据集用于Stage A Applicability模型的鲁棒性训练。
所有样本的label=0（负类）。

在训练时，这些数据集会与原始GitHub负类数据合并使用。
"""
    
    readme_path = OUTPUT_DIR / 'README.md'
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(readme_content)
    
    print(f"\n统计信息已保存: {stats_path}")
    print(f"README已创建: {readme_path}")
    print("\n" + "=" * 60)
    print("数据集生成完成！")
    print("=" * 60)


if __name__ == '__main__':
    main()

