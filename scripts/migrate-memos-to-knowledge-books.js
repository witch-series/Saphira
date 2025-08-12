/**
 * Migrate existing memos from user/memos to Knowledge Book JSON files
 */

const fs = require('fs').promises;
const path = require('path');

async function migrateMemos() {
  const memosDir = path.join(__dirname, '../user/memos');
  const dataDir = path.join(__dirname, '../user/data');
  
  try {
    // Check if memos directory exists
    try {
      await fs.access(memosDir);
    } catch (error) {
      console.log('✅ No memos directory found - nothing to migrate');
      return;
    }

    const memoFiles = await fs.readdir(memosDir);
    const jsonMemoFiles = memoFiles.filter(file => file.endsWith('.json'));

    if (jsonMemoFiles.length === 0) {
      console.log('✅ No memo files found - nothing to migrate');
      return;
    }

    console.log(`Found ${jsonMemoFiles.length} memo files to migrate:`);
    
    let migratedCount = 0;
    let failedCount = 0;

    for (const memoFile of jsonMemoFiles) {
      try {
        // Parse memo filename: {knowledgeBookFilename}-item-{itemIndex}.json
        const match = memoFile.match(/^(.+)-item-(\d+)\.json$/);
        if (!match) {
          console.log(`⚠️ Skipping invalid memo filename: ${memoFile}`);
          continue;
        }

        const [, knowledgeBookFilename, itemIndexStr] = match;
        const itemIndex = parseInt(itemIndexStr);

        // Load memo content
        const memoPath = path.join(memosDir, memoFile);
        const memoContent = await fs.readFile(memoPath, 'utf8');
        const memoData = JSON.parse(memoContent);

        // Load Knowledge Book JSON file
        const knowledgeBookPath = path.join(dataDir, knowledgeBookFilename);
        
        try {
          const knowledgeBookContent = await fs.readFile(knowledgeBookPath, 'utf8');
          const knowledgeBook = JSON.parse(knowledgeBookContent);

          // Validate item index
          if (!knowledgeBook.results || itemIndex >= knowledgeBook.results.length) {
            console.log(`⚠️ Invalid item index ${itemIndex} for ${knowledgeBookFilename}`);
            failedCount++;
            continue;
          }

          // Add memo to Knowledge Book item
          if (!knowledgeBook.results[itemIndex].userMemo) {
            knowledgeBook.results[itemIndex].userMemo = {};
          }

          knowledgeBook.results[itemIndex].userMemo = {
            content: memoData.content || '',
            lastUpdated: memoData.lastUpdated || new Date().toISOString(),
            createdAt: memoData.lastUpdated || new Date().toISOString(),
            migratedFrom: memoFile,
            migratedAt: new Date().toISOString()
          };

          // Save updated Knowledge Book
          await fs.writeFile(knowledgeBookPath, JSON.stringify(knowledgeBook, null, 2), 'utf8');
          
          console.log(`✅ Migrated memo: ${memoFile} → ${knowledgeBookFilename}[${itemIndex}]`);
          migratedCount++;

        } catch (knowledgeBookError) {
          console.log(`❌ Failed to load Knowledge Book ${knowledgeBookFilename}: ${knowledgeBookError.message}`);
          failedCount++;
        }

      } catch (error) {
        console.error(`❌ Failed to migrate ${memoFile}:`, error.message);
        failedCount++;
      }
    }

    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Successfully migrated: ${migratedCount} memos`);
    
    if (failedCount > 0) {
      console.log(`❌ Failed to migrate: ${failedCount} memos`);
    }

    if (migratedCount > 0) {
      console.log(`\n💡 You can now delete the user/memos directory if migration was successful.`);
      console.log(`   Run: Remove-Item "user/memos" -Recurse -Force`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateMemos();
}

module.exports = migrateMemos;
