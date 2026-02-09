const axios = require('axios');

async function testBatchResponse() {
  const testSamples = [
    {
      sample_id: 'TEST-001',
      text_description: 'A critical vulnerability was found in the authentication system that allows unauthorized access.',
      cvss_base_score: 9.0
    },
    {
      sample_id: 'TEST-002',
      text_description: 'A minor issue with the user interface that causes display problems.',
      cvss_base_score: 2.0
    }
  ];

  try {
    const response = await axios.post('http://localhost:5000/predict/batch', {
      relevance_model_path: '/app/models/app_model_002_aug_xgb',
      sev_model_path: '/app/models/sev_model_001',
      relevance_threshold: 0.5,
      samples: testSamples
    });

    console.log('批量预测响应:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n检查每个预测的 riskScore 和 riskLevel 映射:');
    response.data.predictions.forEach(pred => {
      const riskScore = pred.riskScore;
      const riskLevel = pred.riskLevel;
      const severityLevel = pred.severityLevel;
      
      // 计算正确的 riskLevel
      let correctRiskLevel;
      if (riskScore < 0.4) {
        correctRiskLevel = 'Low';
      } else if (riskScore < 0.6) {
        correctRiskLevel = 'Medium';
      } else if (riskScore < 0.8) {
        correctRiskLevel = 'High';
      } else {
        correctRiskLevel = 'Critical';
      }
      
      const isCorrect = riskLevel === correctRiskLevel;
      console.log(`\n${pred.sample_id}:`);
      console.log(`  riskScore: ${riskScore}`);
      console.log(`  riskLevel: ${riskLevel} ${isCorrect ? '✓' : '✗ (应该是 ' + correctRiskLevel + ')'}`);
      console.log(`  severityLevel: ${severityLevel}`);
    });
  } catch (error) {
    console.error('错误:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
  }
}

testBatchResponse();

