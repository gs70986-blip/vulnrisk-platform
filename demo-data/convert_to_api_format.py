#!/usr/bin/env python3
"""
转换演示数据集为API格式的脚本

将原始数据集（使用sampleId, textDescription）转换为API格式（使用sample_id, text_description）
"""

import csv
import json
import sys
from pathlib import Path

def convert_csv_to_api_format(input_file: str, output_file: str):
    """将CSV文件从原始格式转换为API格式"""
    rows = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 转换字段名
            api_row = {
                'sample_id': row.get('sampleId', row.get('sample_id', '')),
                'text_description': row.get('textDescription', row.get('text_description', ''))
            }
            
            # 可选字段
            if 'cvss_base_score' in row:
                api_row['cvss_base_score'] = row['cvss_base_score']
            elif 'cvssBaseScore' in row:
                api_row['cvss_base_score'] = row['cvssBaseScore']
            
            rows.append(api_row)
    
    # 写入新文件
    if rows:
        fieldnames = ['sample_id', 'text_description']
        if any('cvss_base_score' in row for row in rows):
            fieldnames.append('cvss_base_score')
        
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        print(f"[OK] Converted {len(rows)} rows: {input_file} -> {output_file}")
    else:
        print(f"[ERROR] No rows found in {input_file}")

def convert_jsonl_to_api_json(input_file: str, output_file: str):
    """将JSONL文件转换为API格式的JSON文件"""
    samples = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            try:
                obj = json.loads(line)
                api_obj = {
                    'sample_id': obj.get('sampleId', obj.get('sample_id', '')),
                    'text_description': obj.get('textDescription', obj.get('text_description', ''))
                }
                
                if 'cvss_base_score' in obj:
                    api_obj['cvss_base_score'] = obj['cvss_base_score']
                elif 'cvssBaseScore' in obj:
                    api_obj['cvss_base_score'] = obj['cvssBaseScore']
                
                samples.append(api_obj)
            except json.JSONDecodeError as e:
                print(f"Warning: Failed to parse line: {e}")
    
    # 写入JSON文件（API格式）
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({'samples': samples}, f, indent=2, ensure_ascii=False)
    
    print(f"[OK] Converted {len(samples)} samples: {input_file} -> {output_file}")

def main():
    """主函数"""
    demo_dir = Path(__file__).parent
    
    # 转换CSV文件
    csv_files = [
        ('positives.csv', 'positives_api_format.csv'),
        ('negatives.csv', 'negatives_api_format.csv'),
        ('augmented_negatives.csv', 'augmented_negatives_api_format.csv'),
    ]
    
    print("Converting CSV files...")
    for input_file, output_file in csv_files:
        input_path = demo_dir / input_file
        output_path = demo_dir / output_file
        
        if input_path.exists():
            convert_csv_to_api_format(str(input_path), str(output_path))
        else:
            print(f"[ERROR] File not found: {input_path}")
    
    # 转换JSONL文件
    print("\nConverting JSONL file...")
    jsonl_path = demo_dir / 'all_demo.jsonl'
    json_path = demo_dir / 'all_demo_api_format.json'
    
    if jsonl_path.exists():
        convert_jsonl_to_api_json(str(jsonl_path), str(json_path))
    else:
        print(f"✗ File not found: {jsonl_path}")
    
    print("\n[OK] Conversion completed!")

if __name__ == '__main__':
    main()

