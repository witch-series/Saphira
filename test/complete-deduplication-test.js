/**
 * 完全なURL重複防止テスト - キャッシュ無効化
 */

const SearchService = require('../src/searchService');
const URLTracker = require('../src/services/url-tracker');
const path = require('path');
const fs = require('fs').promises;

async function testFullDeduplication() {
  console.log('🧪 Testing complete URL deduplication without cache...\n');

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

    // SearchServiceを作成（キャッシュTTL=0で無効化）
    const searchService = new SearchService({ cacheTtl: 0 });

    // 手動でいくつかのURLをurl-list.jsonに追加
    const urlTracker = new URLTracker();
    await urlTracker.initialize();
    
    const existingUrls = [
      'https://en.wikipedia.org/wiki/Python_(programming_language)',
      'https://en.wikipedia.org/wiki/Machine_learning'
    ];
    
    await urlTracker.addURLs(existingUrls);
    await urlTracker.save();
    console.log(`📋 Pre-added ${existingUrls.length} URLs to tracking list`);
    console.log(`🔗 URLs: ${existingUrls.join(', ')}\n`);

    console.log('🔍 First search: "python programming"...');
    const searchResult1 = await searchService.search('python programming', {
      sources: ['wikipedia'],
      maxResults: 5
    });
    const results1 = searchResult1.results || [];
    console.log(`📊 First search found ${results1.length} results (should filter out known URLs)`);
    
    if (results1.length > 0) {
      console.log('📋 New URLs found:');
      results1.forEach(r => console.log(`  - ${r.url}`));
    } else {
      console.log('✅ All URLs were filtered out - perfect deduplication!');
    }

    console.log('\n🔍 Second search: "machine learning"...');  
    const searchResult2 = await searchService.search('machine learning', {
      sources: ['wikipedia'],
      maxResults: 5
    });
    const results2 = searchResult2.results || [];
    console.log(`📊 Second search found ${results2.length} results`);
    
    if (results2.length > 0) {
      console.log('📋 New URLs found:');
      results2.forEach(r => console.log(`  - ${r.url}`));
    } else {
      console.log('✅ All URLs were filtered out - perfect deduplication!');
    }

    // URL追跡の最終状態を確認
    await urlTracker.initialize(); // リフレッシュ
    console.log(`\n🔗 Final URL tracking count: ${await urlTracker.getURLCount()}`);

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
testFullDeduplication()
  .then(() => {
    console.log('\n🏁 Complete URL deduplication test finished');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test crashed:', error);
    process.exit(1);
  });
