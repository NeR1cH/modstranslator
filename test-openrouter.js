// Тестовый скрипт для проверки OpenRouter интеграции
const { translator } = require('./lib/translator');

async function test() {
  console.log('🧪 Testing OpenRouter integration...\n');

  try {
    const result = await translator.translate('Diamond Sword', { targetLang: 'RU' });
    console.log('\n✅ Translation result:', result);
    console.log('✅ Provider used:', translator.getProviderName());
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

test();
