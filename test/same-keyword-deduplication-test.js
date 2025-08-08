/**
 * 同一キーワードでのURL重複防止テスト
 */

const SearchService = require('../src/searchService');
const path = require('path');
const fs = require('fs').promises;

async function testSameKeywordDeduplication() {
  console.log('🧪 Testing same keyword URL deduplication...\n');

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

    // SearchServiceを作成
    const searchService = new SearchService();

    console.log('🔍 First search: "python programming"...');
    const searchResult1 = await searchService.search('python programming', {
      sources: ['wikipedia'],
      maxResults: 3,
      useCache: false
    });
    const results1 = searchResult1.results || [];
    console.log(`📊 First search found ${results1.length} results`);
    console.log(`📋 URLs: ${results1.map(r => r.url).join(', ')}\n`);

    console.log('🔍 Second search: same query "python programming"...');
    const searchResult2 = await searchService.search('python programming', {
      sources: ['wikipedia'],
      maxResults: 3,
      useCache: false
    });
    const results2 = searchResult2.results || [];
    console.log(`📊 Second search found ${results2.length} results`);
    console.log(`📋 URLs: ${results2.map(r => r.url).join(', ')}\n`);

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
      console.log('✅ No duplicates - URL deduplication working perfectly!');
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
testSameKeywordDeduplication()
  .then(() => {
    console.log('\n🏁 Same keyword deduplication test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test crashed:', error);
    process.exit(1);
  });
