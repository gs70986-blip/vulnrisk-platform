#!/usr/bin/env python3
"""
验证API格式数据集的脚本
"""

import csv
import json
import sys
from pathlib import Path

def validate_csv(file_path):
    """验证CSV文件格式"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            required_fields = ['sample_id', 'text_description']
            
            rows = list(reader)
            if not rows:
                print(f"[ERROR] {file_path}: File is empty")
                return False
            
            for i, row in enumerate(rows, 1):
                for field in required_fields:
                    if field not in row:
                        print(f"[ERROR] {file_path} row {i}: Missing field '{field}'")
                        return False
                    if not row[field] or not row[field].strip():
                        print(f"[ERROR] {file_path} row {i}: Empty '{field}'")
                        return False
            
            print(f"[OK] {file_path}: {len(rows)} samples, format valid")
            return True
    except Exception as e:
        print(f"[ERROR] {file_path}: {e}")
        return False

def validate_json(file_path):
    """验证JSON文件格式"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            if isinstance(data, list):
                samples = data
            elif isinstance(data, dict) and 'samples' in data:
                samples = data['samples']
            else:
                print(f"[ERROR] {file_path}: Invalid format (expected array or {{'samples': [...]}})")
                return False
            
            if not samples:
                print(f"[ERROR] {file_path}: No samples found")
                return False
            
            for i, sample in enumerate(samples, 1):
                if 'sample_id' not in sample or not sample['sample_id']:
                    print(f"[ERROR] {file_path} sample {i}: Missing or empty 'sample_id'")
                    return False
                if 'text_description' not in sample or not sample['text_description']:
                    print(f"[ERROR] {file_path} sample {i}: Missing or empty 'text_description'")
                    return False
            
            print(f"[OK] {file_path}: {len(samples)} samples, format valid")
            return True
    except Exception as e:
        print(f"[ERROR] {file_path}: {e}")
        return False

def main():
    """主函数"""
    demo_dir = Path(__file__).parent
    
    print("=" * 60)
    print("Validating API format files...")
    print("=" * 60)
    
    # 验证CSV文件
    csv_files = [
        'positives_api_format.csv',
        'negatives_api_format.csv',
        'augmented_negatives_api_format.csv',
    ]
    
    csv_results = []
    for csv_file in csv_files:
        file_path = demo_dir / csv_file
        if file_path.exists():
            csv_results.append(validate_csv(str(file_path)))
        else:
            print(f"[WARNING] {csv_file}: File not found")
            csv_results.append(False)
    
    # 验证JSON文件
    json_file = demo_dir / 'all_demo_api_format.json'
    json_result = validate_json(str(json_file)) if json_file.exists() else False
    
    # 总结
    print("\n" + "=" * 60)
    print("Validation Summary:")
    print("=" * 60)
    all_valid = all(csv_results) and json_result
    if all_valid:
        print("[SUCCESS] All files are valid and ready for API use!")
    else:
        print("[FAILED] Some files have validation errors. Please fix them before use.")
        sys.exit(1)

if __name__ == '__main__':
    main()


