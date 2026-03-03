// Server-side Symptom Analysis Service
// This mirrors the client-side service but can integrate with more powerful AI APIs
// and maintain medical knowledge bases on the server

class SymptomAnalysisService {
  constructor() {
    this.huggingFaceToken = process.env.HUGGING_FACE_TOKEN;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.googleCloudApiKey = process.env.GOOGLE_CLOUD_API_KEY;
    
    // Medical knowledge base (same as client but can be extended with database)
    this.medicalKnowledge = {
      symptoms: {
        fever: {
          weight: 0.8,
          associatedWith: ['infection', 'flu', 'covid', 'bacterial_infection'],
          urgency: 'moderate',
          icd10: 'R50.9'
        },
        'chest pain': {
          weight: 0.95,
          associatedWith: ['heart_attack', 'angina', 'pneumonia', 'anxiety'],
          urgency: 'high',
          icd10: 'R06.02'
        },
        'shortness of breath': {
          weight: 0.9,
          associatedWith: ['asthma', 'heart_failure', 'pneumonia', 'covid'],
          urgency: 'high',
          icd10: 'R06.00'
        },
        headache: {
          weight: 0.6,
          associatedWith: ['tension', 'migraine', 'dehydration', 'hypertension'],
          urgency: 'low',
          icd10: 'R51'
        },
        cough: {
          weight: 0.5,
          associatedWith: ['cold', 'flu', 'bronchitis', 'pneumonia'],
          urgency: 'low',
          icd10: 'R05'
        },
        'sore throat': {
          weight: 0.4,
          associatedWith: ['strep_throat', 'viral_infection', 'allergies'],
          urgency: 'low',
          icd10: 'R07.0'
        },
        nausea: {
          weight: 0.5,
          associatedWith: ['gastroenteritis', 'food_poisoning', 'pregnancy', 'migraine'],
          urgency: 'low',
          icd10: 'R11'
        },
        fatigue: {
          weight: 0.3,
          associatedWith: ['anemia', 'depression', 'thyroid', 'infection'],
          urgency: 'low',
          icd10: 'R53'
        },
        dizziness: {
          weight: 0.6,
          associatedWith: ['vertigo', 'low_blood_pressure', 'dehydration', 'anemia'],
          urgency: 'moderate',
          icd10: 'R42'
        },
        'abdominal pain': {
          weight: 0.7,
          associatedWith: ['appendicitis', 'gastroenteritis', 'gallstones', 'ulcer'],
          urgency: 'moderate',
          icd10: 'R10.9'
        }
      },
      
      conditions: {
        viral_upper_respiratory: {
          name: 'Viral Upper Respiratory Infection',
          description: 'Common cold or flu-like illness caused by viral infection',
          symptoms: ['fever', 'cough', 'sore throat', 'runny nose', 'fatigue'],
          treatmentAdvice: [
            'Rest and stay hydrated',
            'Use over-the-counter pain relievers if needed',
            'Gargle with warm salt water for sore throat',
            'Avoid antibiotics (ineffective against viruses)'
          ],
          duration: '3-7 days',
          urgency: 'low',
          icd10: 'J06.9'
        },
        influenza: {
          name: 'Influenza (Flu)',
          description: 'Seasonal flu with typical symptoms including body aches',
          symptoms: ['fever', 'cough', 'fatigue', 'muscle aches', 'headache'],
          treatmentAdvice: [
            'Rest and increase fluid intake',
            'Antiviral medication if started within 48 hours',
            'Monitor temperature and symptoms',
            'Isolate to prevent spread'
          ],
          duration: '5-10 days',
          urgency: 'moderate',
          icd10: 'J11.1'
        },
        tension_headache: {
          name: 'Tension Headache',
          description: 'Most common type of headache, often stress-related',
          symptoms: ['headache', 'neck tension', 'fatigue'],
          treatmentAdvice: [
            'Apply hot or cold compress to head/neck',
            'Practice relaxation techniques',
            'Maintain regular sleep schedule',
            'Stay hydrated and limit caffeine'
          ],
          duration: '30 minutes to several hours',
          urgency: 'low',
          icd10: 'G44.209'
        },
        cardiac_concern: {
          name: 'Possible Cardiac Issue',
          description: 'Chest pain or related symptoms requiring immediate medical evaluation',
          symptoms: ['chest pain', 'shortness of breath', 'sweating', 'nausea'],
          treatmentAdvice: [
            'Seek immediate medical attention',
            'Call emergency services if severe',
            'Do not ignore chest pain',
            'Avoid physical exertion'
          ],
          duration: 'Variable',
          urgency: 'high',
          icd10: 'R06.02'
        }
      }
    };

    // Emergency keywords that trigger immediate alerts
    this.emergencyKeywords = [
      'chest pain',
      'heart attack',
      'can\'t breathe',
      'difficulty breathing',
      'severe bleeding',
      'unconscious',
      'seizure',
      'stroke',
      'severe allergic reaction',
      'poisoning',
      'suicidal thoughts',
      'severe abdominal pain'
    ];
  }

  // Main analysis method
  async analyzeSymptoms(symptomText, context = {}) {
    try {
      // Log analysis request
      console.log(`Analyzing symptoms: ${symptomText.substring(0, 100)}...`);
      
      // Check for emergency first
      if (this.isEmergency(symptomText)) {
        return this.createEmergencyResponse(symptomText, context);
      }

      // Try AI analysis if available
      if (this.huggingFaceToken || this.openaiApiKey) {
        try {
          return await this.performAIAnalysis(symptomText, context);
        } catch (error) {
          console.error('AI analysis failed, falling back to rule-based:', error);
        }
      }

      // Fallback to rule-based analysis
      return await this.ruleBasedAnalysis(symptomText, context);

    } catch (error) {
      console.error('Symptom analysis error:', error);
      throw error;
    }
  }

  // Check for emergency keywords
  isEmergency(symptomText) {
    const lowerText = symptomText.toLowerCase();
    return this.emergencyKeywords.some(keyword => lowerText.includes(keyword));
  }

  // Create emergency response
  createEmergencyResponse(symptomText, context) {
    return {
      possibleConditions: [{
        condition: 'Medical Emergency',
        confidence: 95,
        description: 'Your symptoms may indicate a medical emergency requiring immediate attention',
        treatmentAdvice: [
          'Seek immediate medical attention',
          'Call emergency services (911)',
          'Do not delay medical care'
        ],
        duration: 'Immediate',
        urgency: 'emergency'
      }],
      recommendations: [
        'Call 911 or go to the nearest emergency room immediately',
        'Do not drive yourself if experiencing severe symptoms',
        'Have someone stay with you until help arrives',
        'Take any relevant medical information with you'
      ],
      urgencyLevel: 'high',
      isEmergency: true,
      confidence: 95,
      disclaimer: 'This is an emergency situation. Seek immediate medical attention.',
      analysisMethod: 'emergency-detection'
    };
  }

  // AI-powered analysis using available services
  async performAIAnalysis(symptomText, context) {
    // Try Hugging Face first
    if (this.huggingFaceToken) {
      try {
        return await this.huggingFaceAnalysis(symptomText, context);
      } catch (error) {
        console.error('Hugging Face analysis failed:', error);
      }
    }

    // Try OpenAI
    if (this.openaiApiKey) {
      try {
        return await this.openaiAnalysis(symptomText, context);
      } catch (error) {
        console.error('OpenAI analysis failed:', error);
      }
    }

    // Fallback to rule-based
    return await this.ruleBasedAnalysis(symptomText, context);
  }

  // Hugging Face medical AI analysis
  async huggingFaceAnalysis(symptomText, context) {
    const medicalModels = [
      'microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext',
      'emilyalsentzer/Bio_ClinicalBERT',
      'microsoft/DialoGPT-medium'
    ];

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${medicalModels[0]}`,
      {
        headers: {
          'Authorization': `Bearer ${this.huggingFaceToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          inputs: `Medical symptom analysis for: ${symptomText}. Severity: ${context.severity}, Duration: ${context.duration}`,
          parameters: {
            max_length: 200,
            temperature: 0.3,
            do_sample: true
          }
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status}`);
    }

    const result = await response.json();
    
    // Combine AI insights with rule-based analysis
    const ruleBasedResult = await this.ruleBasedAnalysis(symptomText, context);
    
    return {
      ...ruleBasedResult,
      aiInsights: result[0]?.generated_text || 'AI analysis available',
      analysisMethod: 'ai-enhanced-hf'
    };
  }

  // OpenAI analysis (GPT-based)
  async openaiAnalysis(symptomText, context) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: 'You are a medical AI assistant. Analyze symptoms and provide possible conditions with confidence levels. Always recommend consulting healthcare professionals.'
        }, {
          role: 'user',
          content: `Analyze these symptoms: ${symptomText}. Severity: ${context.severity}, Duration: ${context.duration}`
        }],
        max_tokens: 300,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const aiAnalysis = result.choices[0]?.message?.content;

    // Combine with rule-based analysis
    const ruleBasedResult = await this.ruleBasedAnalysis(symptomText, context);
    
    return {
      ...ruleBasedResult,
      aiInsights: aiAnalysis,
      analysisMethod: 'ai-enhanced-openai'
    };
  }

  // Rule-based analysis (same logic as client but can be more sophisticated on server)
  async ruleBasedAnalysis(symptomText, context = {}) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    const lowerSymptoms = symptomText.toLowerCase();
    const { severity = 'mild', duration = '', additionalInfo = {} } = context;
    
    // Extract symptoms
    const detectedSymptoms = this.extractSymptoms(lowerSymptoms);
    
    // Calculate condition probabilities
    const possibleConditions = this.calculateConditionProbabilities(detectedSymptoms, context);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(possibleConditions, detectedSymptoms, context);
    
    // Determine urgency
    const urgencyLevel = this.determineUrgency(detectedSymptoms, severity);
    
    return {
      possibleConditions: possibleConditions.slice(0, 3),
      recommendations,
      urgencyLevel,
      detectedSymptoms,
      confidence: Math.max(...possibleConditions.map(c => c.confidence)),
      disclaimer: 'This analysis is for informational purposes only and should not replace professional medical consultation.',
      analysisMethod: 'rule-based-server'
    };
  }

  // Extract symptoms from text
  extractSymptoms(text) {
    const symptoms = [];
    Object.keys(this.medicalKnowledge.symptoms).forEach(symptom => {
      if (text.includes(symptom)) {
        symptoms.push({
          name: symptom,
          weight: this.medicalKnowledge.symptoms[symptom].weight,
          urgency: this.medicalKnowledge.symptoms[symptom].urgency,
          icd10: this.medicalKnowledge.symptoms[symptom].icd10
        });
      }
    });
    return symptoms;
  }

  // Calculate condition probabilities
  calculateConditionProbabilities(detectedSymptoms, context) {
    const conditionScores = {};
    
    // Initialize scores
    Object.keys(this.medicalKnowledge.conditions).forEach(conditionKey => {
      conditionScores[conditionKey] = 0;
    });
    
    // Score based on symptom matches
    detectedSymptoms.forEach(symptom => {
      const symptomData = this.medicalKnowledge.symptoms[symptom.name];
      if (symptomData && symptomData.associatedWith) {
        symptomData.associatedWith.forEach(condition => {
          if (conditionScores.hasOwnProperty(condition)) {
            conditionScores[condition] += symptom.weight;
          }
        });
      }
    });

    // Apply context modifiers
    if (context.severity === 'severe') {
      Object.keys(conditionScores).forEach(key => {
        conditionScores[key] *= 1.2; // Increase scores for severe symptoms
      });
    }

    if (context.duration === 'longer') {
      // Chronic conditions more likely
      conditionScores.chronic_condition = (conditionScores.chronic_condition || 0) + 0.3;
    }

    // Convert to condition objects
    const conditions = Object.entries(conditionScores)
      .filter(([_, score]) => score > 0.1)
      .map(([conditionKey, score]) => {
        const condition = this.medicalKnowledge.conditions[conditionKey];
        if (!condition) return null;
        
        return {
          condition: condition.name,
          confidence: Math.min(Math.round(score * 100), 95),
          description: condition.description,
          treatmentAdvice: condition.treatmentAdvice,
          duration: condition.duration,
          urgency: condition.urgency,
          icd10: condition.icd10
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.confidence - a.confidence);

    return conditions.length > 0 ? conditions : [{
      condition: 'General Health Concern',
      confidence: 60,
      description: 'Your symptoms require professional medical evaluation',
      treatmentAdvice: ['Schedule an appointment with your healthcare provider'],
      duration: 'Variable',
      urgency: 'moderate'
    }];
  }

  // Generate recommendations
  generateRecommendations(possibleConditions, detectedSymptoms, context) {
    const recommendations = [];
    const topCondition = possibleConditions[0];
    
    if (topCondition) {
      recommendations.push(...topCondition.treatmentAdvice.slice(0, 3));
    }
    
    // Context-based recommendations
    if (context.severity === 'severe' || topCondition?.urgency === 'high') {
      recommendations.unshift('Seek immediate medical attention');
    }
    
    if (context.duration === 'longer') {
      recommendations.push('Consider seeing a specialist for persistent symptoms');
    }
    
    // General recommendations
    recommendations.push('Monitor your symptoms and track any changes');
    recommendations.push('Stay hydrated and get adequate rest');
    recommendations.push('This analysis is not a substitute for professional medical advice');
    recommendations.push('Consult with a healthcare provider for proper diagnosis and treatment');
    
    return [...new Set(recommendations)];
  }

  // Determine urgency level
  determineUrgency(detectedSymptoms, severity) {
    const highUrgencySymptoms = ['chest pain', 'shortness of breath', 'severe headache'];
    const moderateUrgencySymptoms = ['fever', 'abdominal pain', 'dizziness'];
    
    const symptomNames = detectedSymptoms.map(s => s.name);
    
    if (symptomNames.some(s => highUrgencySymptoms.includes(s)) || severity === 'severe') {
      return 'high';
    }
    
    if (symptomNames.some(s => moderateUrgencySymptoms.includes(s)) || severity === 'moderate') {
      return 'moderate';
    }
    
    return 'low';
  }

  // Validate symptoms
  validateSymptoms(symptoms) {
    if (!symptoms || symptoms.trim().length < 3) {
      return {
        isValid: false,
        message: 'Please provide more detailed symptom description (at least 3 characters)'
      };
    }
    
    if (symptoms.length > 2000) {
      return {
        isValid: false,
        message: 'Symptom description is too long (maximum 2000 characters)'
      };
    }
    
    return { isValid: true };
  }
}

export default new SymptomAnalysisService();