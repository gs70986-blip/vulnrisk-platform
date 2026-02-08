import pandas as pd
import random

# 读取CSV文件
df = pd.read_csv('ml-service/merged_json_table.csv')

# 筛选有严重程度标签的数据，排除NONE，并且必须有描述
df_with_severity = df[
    df['cvss_severity'].notna() & 
    df['cvss_severity'].isin(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) &
    df['description_clean'].notna() &
    (df['description_clean'].str.strip() != '')
]

# 设置随机种子以确保可重复
random.seed(42)

samples = []
# 从每种严重程度中提取样本
# LOW: 2条, MEDIUM: 3条, HIGH: 3条, CRITICAL: 2条
severity_counts = {
    'LOW': 2,
    'MEDIUM': 3,
    'HIGH': 3,
    'CRITICAL': 2
}

for severity in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']:
    subset = df_with_severity[df_with_severity['cvss_severity'] == severity]
    if len(subset) > 0:
        count = severity_counts[severity]
        sampled = subset.sample(n=min(count, len(subset)), random_state=42)
        samples.append(sampled)

# 合并所有样本
result = pd.concat(samples, ignore_index=True)

# 选择需要的列并重命名为后端期望的字段名
result = result[['cve_id', 'description_clean', 'cvss_severity', 'cvss_base']].copy()
result.rename(columns={
    'cve_id': 'sample_id',
    'description_clean': 'text_description',
    'cvss_base': 'cvss_base_score'
}, inplace=True)

# 按严重程度排序（LOW, MEDIUM, HIGH, CRITICAL）
severity_order = {'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4}
result['severity_order'] = result['cvss_severity'].map(severity_order)
result = result.sort_values('severity_order').drop('severity_order', axis=1)

# 保存到CSV文件（使用utf-8避免BOM字符）
result.to_csv('stage_b_validation_samples.csv', index=False, encoding='utf-8')

# 打印结果
print("=" * 80)
print("提取的 Stage B 验证样本（共10条）")
print("=" * 80)
print(f"\n严重程度分布:")
print(result['cvss_severity'].value_counts().sort_index())
print("\n" + "=" * 80)
print("详细数据:")
print("=" * 80)
for idx, row in result.iterrows():
    desc = str(row['text_description']) if pd.notna(row['text_description']) else 'N/A'
    desc_short = desc[:200] + '...' if len(desc) > 200 else desc
    cvss = row['cvss_base_score'] if pd.notna(row['cvss_base_score']) else 'N/A'
    print(f"\n[{idx+1}] {row['sample_id']} - {row['cvss_severity']} (CVSS: {cvss})")
    print(f"描述: {desc_short}")

print("\n" + "=" * 80)
print(f"已保存到: stage_b_validation_samples.csv")
print("=" * 80)

