/**
 * Test script to compare different OpenRouter models
 * Tests translation quality for Minecraft mod strings
 */

const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    process.env[key] = value;
  }
}

const MODELS = [
  'openai/gpt-oss-120b:free',
  'z-ai/glm-4.5-air:free',
  'qwen/qwen3-coder:free',
  'nvidia/nemotron-3-super-120b-a12b:free'
];

const TEST_STRINGS = [
  'Iron Ingot',
  'Diamond Sword',
  'Collect 10 iron ingots from the mine',
  'Craft a diamond pickaxe',
  'Smelt copper ore in a furnace'
];

async function testModel(model, text) {
  const systemPrompt = `You are a professional translator specializing in Minecraft mod localization.
Translate the following text from English to Russian.

CRITICAL RULES:
1. Preserve ALL Minecraft formatting codes (§6, §a, §l, §r, etc.)
2. Preserve ALL placeholders (%s, %d, %1$s, {0}, {1}, etc.)
3. Keep the translation natural and game-appropriate
4. Use standard Minecraft terminology in Russian

Return ONLY the translated text, nothing else.`;

  try {
    const startTime = Date.now();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'MOD_TRANSLATOR'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return {
        success: false,
        error: 'Invalid response structure',
        duration
      };
    }

    return {
      success: true,
      translation: data.choices[0].message.content.trim(),
      duration
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: 0
    };
  }
}

async function compareModels() {
  console.log('🧪 Testing OpenRouter Models for Translation Quality\n');
  console.log('='.repeat(80));

  for (const testString of TEST_STRINGS) {
    console.log(`\n📝 Original: "${testString}"\n`);

    for (const model of MODELS) {
      const modelName = model.split('/')[1].split(':')[0];
      process.stdout.write(`   ${modelName.padEnd(30)} ... `);

      const result = await testModel(model, testString);

      if (result.success) {
        console.log(`✅ ${result.translation} (${result.duration}ms)`);
      } else {
        console.log(`❌ ${result.error}`);
      }

      // Rate limit: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '-'.repeat(80));
  }

  console.log('\n✅ Testing complete!\n');
}

// Run tests
compareModels().catch(console.error);
