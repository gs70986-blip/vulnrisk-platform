"""
一键重训脚本
按顺序执行：
1. build_github_dataset.py
2. train_applicability_model.py
3. train_severity_model.py

并生成重训报告

用法:
    python run_retrain_pipeline.py [--n-samples N] [--skip-github] [--skip-app] [--skip-sev]

示例:
    python run_retrain_pipeline.py
    python run_retrain_pipeline.py --n-samples 50000
"""

import argparse
import subprocess
import sys
import json
from pathlib import Path
from datetime import datetime

# 默认参数
DEFAULT_N_SAMPLES = 50000


def run_command(cmd, description):
    """
    运行命令并处理错误
    
    Args:
        cmd: 命令列表
        description: 命令描述
    """
    print('\n' + '=' * 60)
    print(f'执行: {description}')
    print('=' * 60)
    print(f'命令: {" ".join(cmd)}')
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print('警告:', result.stderr)
        return True
    except subprocess.CalledProcessError as e:
        print(f'错误: {e}')
        print('标准输出:', e.stdout)
        print('标准错误:', e.stderr)
        return False


def load_json_file(file_path):
    """
    加载JSON文件
    
    Args:
        file_path: 文件路径
    
    Returns:
        JSON数据或None
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f'警告: 无法加载 {file_path}: {e}')
        return None


def generate_retrain_report(n_samples, skip_github, skip_app, skip_sev):
    """
    生成重训报告
    
    Args:
        n_samples: 采样数量
        skip_github: 是否跳过GitHub数据构建
        skip_app: 是否跳过Applicability模型训练
        skip_sev: 是否跳过Severity模型训练
    """
    print('\n' + '=' * 60)
    print('生成重训报告')
    print('=' * 60)
    
    report = {
        'retrain_date': datetime.now().isoformat(),
        'n_samples': n_samples,
        'steps_completed': [],
        'data_statistics': {},
        'model_metrics': {},
        'xss_example': {},
        'differences': {},
    }
    
    # 加载GitHub数据统计
    if not skip_github:
        github_summary_path = Path(__file__).parent.parent / 'data' / 'github_issues_prs_clean_summary.json'
        github_summary = load_json_file(github_summary_path)
        if github_summary:
            report['steps_completed'].append('build_github_dataset')
            report['data_statistics']['github'] = github_summary
    
    # 加载Applicability模型指标
    if not skip_app:
        app_metadata_path = Path(__file__).parent.parent / 'models' / 'app_model_001' / 'metadata.json'
        app_metadata = load_json_file(app_metadata_path)
        if app_metadata:
            report['steps_completed'].append('train_applicability_model')
            report['model_metrics']['applicability'] = {
                'roc_auc': app_metadata.get('metrics', {}).get('roc_auc'),
                'accuracy': app_metadata.get('metrics', {}).get('accuracy'),
                'precision': app_metadata.get('metrics', {}).get('precision'),
                'recall': app_metadata.get('metrics', {}).get('recall'),
                'f1': app_metadata.get('metrics', {}).get('f1'),
                'app_threshold': app_metadata.get('app_threshold'),
                'n_train_samples': app_metadata.get('n_train_samples'),
                'n_test_samples': app_metadata.get('n_test_samples'),
            }
    
    # 加载Severity模型指标
    if not skip_sev:
        sev_metadata_path = Path(__file__).parent.parent / 'models' / 'sev_model_001' / 'metadata.json'
        sev_metadata = load_json_file(sev_metadata_path)
        if sev_metadata:
            report['steps_completed'].append('train_severity_model')
            report['model_metrics']['severity'] = {
                'macro_f1': sev_metadata.get('metrics', {}).get('macro_f1'),
                'accuracy': sev_metadata.get('metrics', {}).get('accuracy'),
                'macro_precision': sev_metadata.get('metrics', {}).get('macro_precision'),
                'macro_recall': sev_metadata.get('metrics', {}).get('macro_recall'),
                'per_class_metrics': sev_metadata.get('metrics', {}).get('per_class'),
                'severity_labels': sev_metadata.get('severity_labels'),
                'n_train_samples': sev_metadata.get('n_train_samples'),
                'n_test_samples': sev_metadata.get('n_test_samples'),
            }
    
    # XSS样例输入输出对比
    xss_example_text = "Cross-Site Scripting (XSS) vulnerability in the login form. User input is directly rendered in HTML without escaping."
    report['xss_example'] = {
        'input_text': xss_example_text,
        'note': 'This is a typical XSS vulnerability description. The new two-stage model should correctly identify it as applicable and assign a severity level (likely Medium or Low, not N/A).',
    }
    
    # 新旧差异说明
    report['differences'] = {
        'old_system': {
            'description': 'Binary classification (CVSS >= 7.0 = High risk)',
            'problem': 'XSS vulnerabilities often misclassified as "not vulnerability-related" when p_vuln < 0.10',
            'output': 'p_vuln, risk_level (Low/High), risk_score',
        },
        'new_system': {
            'description': 'Two-stage classification: Applicability + 4-class Severity',
            'improvement': 'XSS vulnerabilities correctly identified as applicable and assigned appropriate severity (Low/Medium/High/Critical)',
            'output': 'pApplicable, applicable, severityLevel, severityProbs (4 classes), riskScore',
        },
    }
    
    # 保存报告
    report_path = Path(__file__).parent.parent / 'models' / 'retrain_report.md'
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 生成Markdown报告
    md_content = f"""# VulnRisk 两阶段重训报告

**生成时间**: {report['retrain_date']}

---

## 1. 重训步骤

已完成步骤:
"""
    for step in report['steps_completed']:
        md_content += f"- {step}\n"
    
    md_content += f"""
---

## 2. 数据统计

### GitHub数据清洗
"""
    if 'github' in report['data_statistics']:
        github = report['data_statistics']['github']
        md_content += f"""
- 原始行数: {github.get('raw_count', 'N/A')}
- 保留行数: {github.get('kept_count', 'N/A')}
- 去重数量: {github.get('deduped_count', 'N/A')}
- 平均文本长度: {github.get('avg_len', 'N/A')} 字符
- 最小文本长度: {github.get('min_len', 'N/A')} 字符
- 最大文本长度: {github.get('max_len', 'N/A')} 字符
"""
    else:
        md_content += "未执行GitHub数据清洗步骤\n"
    
    md_content += """
---

## 3. 模型指标

### Applicability模型
"""
    if 'applicability' in report['model_metrics']:
        app = report['model_metrics']['applicability']
        md_content += f"""
- ROC-AUC: {app.get('roc_auc', 'N/A'):.4f}
- Accuracy: {app.get('accuracy', 'N/A'):.4f}
- Precision: {app.get('precision', 'N/A'):.4f}
- Recall: {app.get('recall', 'N/A'):.4f}
- F1: {app.get('f1', 'N/A'):.4f}
- 建议阈值: {app.get('app_threshold', 'N/A')}
- 训练集大小: {app.get('n_train_samples', 'N/A')}
- 测试集大小: {app.get('n_test_samples', 'N/A')}
"""
    else:
        md_content += "未训练Applicability模型\n"
    
    md_content += """
### Severity模型（4类）
"""
    if 'severity' in report['model_metrics']:
        sev = report['model_metrics']['severity']
        md_content += f"""
- Macro F1: {sev.get('macro_f1', 'N/A'):.4f}
- Accuracy: {sev.get('accuracy', 'N/A'):.4f}
- Macro Precision: {sev.get('macro_precision', 'N/A'):.4f}
- Macro Recall: {sev.get('macro_recall', 'N/A'):.4f}
- 训练集大小: {sev.get('n_train_samples', 'N/A')}
- 测试集大小: {sev.get('n_test_samples', 'N/A')}

#### 标签定义
"""
        if sev.get('severity_labels'):
            for label_id, label_info in sev['severity_labels'].items():
                md_content += f"- {label_id}: {label_info.get('name', 'N/A')} - {label_info.get('range', 'N/A')}\n"
        
        md_content += "\n#### 每类指标\n"
        if sev.get('per_class_metrics'):
            for label_name, metrics in sev['per_class_metrics'].items():
                md_content += f"""
- **{label_name}**:
  - Precision: {metrics.get('precision', 'N/A'):.4f}
  - Recall: {metrics.get('recall', 'N/A'):.4f}
  - F1: {metrics.get('f1', 'N/A'):.4f}
"""
    else:
        md_content += "未训练Severity模型\n"
    
    md_content += """
---

## 4. XSS样例输入输出对比

### 输入文本
"""
    md_content += f"""
```
{report['xss_example']['input_text']}
```

### 说明
{report['xss_example']['note']}

---

## 5. 新旧系统差异

### 旧系统
- **描述**: {report['differences']['old_system']['description']}
- **问题**: {report['differences']['old_system']['problem']}
- **输出字段**: {report['differences']['old_system']['output']}

### 新系统
- **描述**: {report['differences']['new_system']['description']}
- **改进**: {report['differences']['new_system']['improvement']}
- **输出字段**: {report['differences']['new_system']['output']}

---

## 6. 模型文件位置

- Applicability模型: `models/app_model_001/`
- Severity模型: `models/sev_model_001/`

每个模型目录包含:
- `model.joblib`: 训练好的模型
- `vectorizer.joblib`: TF-IDF向量化器
- `metadata.json`: 模型元数据和指标
- `training_predictions.csv`: 训练集预测结果（可选）

---

**报告生成完成**
"""
    
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(md_content)
    
    print(f'\n重训报告已保存: {report_path}')
    
    # 同时保存JSON格式
    json_report_path = Path(__file__).parent.parent / 'models' / 'retrain_report.json'
    with open(json_report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f'JSON报告已保存: {json_report_path}')


def main():
    parser = argparse.ArgumentParser(description='一键重训脚本')
    parser.add_argument('--n-samples', type=int, default=DEFAULT_N_SAMPLES,
                        help=f'正负类各采样数量（默认: {DEFAULT_N_SAMPLES}）')
    parser.add_argument('--skip-github', action='store_true',
                        help='跳过GitHub数据构建步骤')
    parser.add_argument('--skip-app', action='store_true',
                        help='跳过Applicability模型训练')
    parser.add_argument('--skip-sev', action='store_true',
                        help='跳过Severity模型训练')
    
    args = parser.parse_args()
    
    print('=' * 60)
    print('VulnRisk 两阶段重训流程')
    print('=' * 60)
    print(f'\n配置:')
    print(f'  采样数量: {args.n_samples}')
    print(f'  跳过GitHub: {args.skip_github}')
    print(f'  跳过Applicability: {args.skip_app}')
    print(f'  跳过Severity: {args.skip_sev}')
    
    success = True
    
    # 步骤1: 构建GitHub数据集
    if not args.skip_github:
        cmd = [sys.executable, 'build_github_dataset.py']
        # GitHub数据构建失败不影响后续流程（数据量可能不足，但可以使用现有数据）
        run_result = run_command(cmd, '构建GitHub训练负类数据')
        if run_result:
            print('\n[PASS] GitHub数据构建成功')
        else:
            print('\n[WARNING] GitHub数据构建遇到问题，但继续执行后续步骤')
            # 不设置 success = False，允许继续执行
    
    # 步骤2: 训练Applicability模型
    if success and not args.skip_app:
        cmd = [sys.executable, 'train_applicability_model.py', '--n-samples', str(args.n_samples)]
        if not run_command(cmd, '训练Applicability模型'):
            print('\n[FAIL] Applicability模型训练失败')
            success = False
        else:
            print('\n[PASS] Applicability模型训练成功')
    
    # 步骤3: 训练Severity模型
    if success and not args.skip_sev:
        config_path = 'train_severity_config.json'
        cmd = [sys.executable, 'train_severity_model.py', config_path]
        if not run_command(cmd, '训练Severity模型（4类）'):
            print('\n[FAIL] Severity模型训练失败')
            success = False
        else:
            print('\n[PASS] Severity模型训练成功')
    
    # 生成报告
    if success:
        generate_retrain_report(args.n_samples, args.skip_github, args.skip_app, args.skip_sev)
        print('\n' + '=' * 60)
        print('[PASS] 重训流程完成！')
        print('=' * 60)
    else:
        print('\n' + '=' * 60)
        print('[FAIL] 重训流程失败，请检查错误信息')
        print('=' * 60)
        sys.exit(1)


if __name__ == '__main__':
    main()

