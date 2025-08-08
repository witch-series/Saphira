/**
 * URLトラッカーの並列処理とKnowledge Book間重複防止テスト
 */

const URLTracker = require('../src/services/url-tracker');
const SearchService = require('../src/searchService');
const KnowledgeBookManager = require('../src/services/knowledge-book-manager');
const path = require('path');
const fs = require('fs').promises;

async function testURLDeduplication() {
  console.log('🧪 Testing URL deduplication between searches...\n');

  try {
    // バックアップファイル作成
    const urlListPath = path.join(__dirname, '../user/url-list.json');
    const backupPath = path.join(__dirname, '../user/url-list-backup.json');
    
    try {
      const originalContent = await fs.readFile(urlListPath, 'utf8');
      await fs.writeFile(backupPath, originalContent);
      console.log('✅ Created backup of url-list.json\n');
    } catch (error) {
      console.log('ℹ️ No existing url-list.json to backup\n');
    }

    // URLトラッカーを初期化
    const urlTracker = new URLTracker();
    await urlTracker.initialize();
    console.log(`🔗 Initial tracked URLs: ${await urlTracker.getURLCount()}\n`);

    // SearchServiceを作成
    const searchService = new SearchService();

    console.log('🔍 First search: "machine learning"...');
    const searchResult1 = await searchService.search('machine learning', {
      sources: ['wikipedia', 'arxiv'],
      maxResults: 5,
      useCache: false
    });
    const results1 = searchResult1.results || [];
    console.log(`📊 First search found ${results1.length} results`);
    
    // URLカウントをチェック
    await urlTracker.initialize(); // リフレッシュ
    console.log(`🔗 URLs tracked after first search: ${await urlTracker.getURLCount()}\n`);

    console.log('🔍 Second search: different query "deep learning"...');
    const searchResult2 = await searchService.search('deep learning', {
      sources: ['wikipedia', 'arxiv'],
      maxResults: 5,
      useCache: false
    });
    const results2 = searchResult2.results || [];
    console.log(`📊 Second search found ${results2.length} results`);
    
    // URLカウントをチェック
    await urlTracker.initialize(); // リフレッシュ
    console.log(`🔗 URLs tracked after second search: ${await urlTracker.getURLCount()}\n`);

    // 結果を比較
    const urls1 = results1.map(r => r.url);
    const urls2 = results2.map(r => r.url);
    const duplicates = urls1.filter(url => urls2.includes(url));
    
    console.log('📈 RESULTS COMPARISON:');
    console.log(`First search URLs: ${urls1.length}`);
    console.log(`Second search URLs: ${urls2.length}`);
    console.log(`Duplicate URLs between searches: ${duplicates.length}`);
    
    if (duplicates.length > 0) {
      console.log('⚠️ DUPLICATES FOUND:');
      duplicates.forEach(url => console.log(`  - ${url}`));
    } else {
      console.log('✅ No duplicates - URL deduplication working!');
    }

    // Knowledge Book作成テスト
    console.log('\n📚 Testing Knowledge Book creation...');
    const kbManager = new KnowledgeBookManager();
    
    if (results1.length > 0) {
      const kb1 = await kbManager.createKnowledgeBook(
        'Test Knowledge Book 1',
        results1,
        'machine learning'
      );
      console.log(`✅ Created Knowledge Book 1: ${kb1.filename}`);
    }

    if (results2.length > 0) {
      const kb2 = await kbManager.createKnowledgeBook(
        'Test Knowledge Book 2', 
        results2,
        'machine learning'
      );
      console.log(`✅ Created Knowledge Book 2: ${kb2.filename}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // バックアップから復元
    try {
      const backupPath = path.join(__dirname, '../user/url-list-backup.json');
      const urlListPath = path.join(__dirname, '../user/url-list.json');
      const backupContent = await fs.readFile(backupPath, 'utf8');
      await fs.writeFile(urlListPath, backupContent);
      await fs.unlink(backupPath);
      console.log('\n✅ Restored original url-list.json from backup');
    } catch (error) {
      console.log('\nℹ️ No backup to restore');
    }
  }
}

// テスト実行
testURLDeduplication()
  .then(() => {
    console.log('\n🏁 URL deduplication test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test crashed:', error);
    process.exit(1);
  });
