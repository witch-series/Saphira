/**
 * Knowledge Item Renderer Service
 * 
 * Knowledge BookとLibraryで共通する表示・エクスポート機能を提供
 */

const fs = require('fs').promises;
const path = require('path');

class KnowledgeItemRenderer {
  constructor(options = {}) {
    this.logger = options.logger || console;
  }

  /**
   * アイテムにカラフルなタグクラスを追加
   * @param {Array} items - アイテムリスト
   * @returns {Array} タグクラス付きアイテム
   */
  enrichItemsWithTagClasses(items) {
    return items.map(item => ({
      ...item,
      tagClasses: this.getTagClasses(item.tags || []),
      sourceClass: this.getSourceClass(item.source)
    }));
  }

  /**
   * タグのCSSクラスを取得
   * @param {Array} tags - タグ配列
   * @returns {Array} タグクラス配列
   */
  getTagClasses(tags) {
    return tags.map(tag => {
      const cleanTag = tag.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return {
        name: tag,
        class: `tag-${cleanTag}`,
        url: `/library?category=${encodeURIComponent(tag)}`
      };
    });
  }

  /**
   * ソースのCSSクラスを取得
   * @param {string} source - ソース名
   * @returns {Object} ソースクラス情報
   */
  getSourceClass(source) {
    if (!source) return { name: '', class: '', url: '' };
    
    const cleanSource = source.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return {
      name: source,
      class: `tag-${cleanSource}`,
      url: `/library?source=${encodeURIComponent(source)}`
    };
  }

  /**
   * Knowledge BookをHTMLエクスポート (Knowledge Book画面と同じ見た目・機能、メモ付き)
   * @param {Object} knowledgeBook - Knowledge Bookデータ
   * @returns {string} HTMLコンテンツ
   */
  exportToHTML(knowledgeBook) {
    const enrichedItems = this.enrichItemsWithTagClasses(knowledgeBook.results || knowledgeBook.items || []);
    
    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(knowledgeBook.title)}</title>
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f8f9fa;
        }
        
        /* Tag styles matching the main application */
        .tag-badge {
            font-size: 0.75rem;
            font-weight: 500;
            padding: 0.25rem 0.5rem;
            border-radius: 0.375rem;
            text-decoration: none;
        }
        
        .tag-wikipedia { background-color: #e3f2fd; color: #1976d2; }
        .tag-openlibrary { background-color: #f3e5f5; color: #7b1fa2; }
        .tag-google { background-color: #fff3e0; color: #f57c00; }
        .tag-arxiv { background-color: #e8f5e8; color: #388e3c; }
        .tag-github { background-color: #f5f5f5; color: #424242; }
        .tag-mdn { background-color: #e1f5fe; color: #0277bd; }
        .tag-stackoverflow { background-color: #fff8e1; color: #f9a825; }
        .tag-mock { background-color: #fce4ec; color: #c2185b; }
        
        .search-result-item-list {
            border: 1px solid #e9ecef;
            border-radius: 0.375rem;
            padding: 1rem;
            background-color: white;
        }
        
        .item-detail {
            display: none;
            margin-top: 1rem;
            padding: 1rem;
            background-color: #f8f9fa;
            border-radius: 0.375rem;
            border-left: 4px solid #0d6efd;
        }
        
        .item-detail.show {
            display: block;
        }
        
        .clickable-title {
            cursor: pointer;
            color: #0d6efd;
            text-decoration: none;
        }
        
        .clickable-title:hover {
            color: #0a58ca;
            text-decoration: underline;
        }
        
        .export-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 0.375rem;
        }
        
        .container-custom {
            max-width: 1200px;
        }
        
        .user-memo {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            border-radius: 0.375rem;
            padding: 0.75rem;
            margin-top: 0.5rem;
        }
        
        .memo-icon {
            color: #ffc107;
        }
    </style>
</head>
<body>
    <div class="container container-custom mt-4">
        <!-- Header -->
        <div class="export-header p-4 mb-4">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h1 class="mb-2">📚 ${this.escapeHtml(knowledgeBook.title)}</h1>
                    <p class="lead mb-0">Search Query: "${this.escapeHtml(knowledgeBook.query || knowledgeBook.keywords || '')}"</p>
                </div>
                <div class="text-end">
                    <small class="opacity-75">Exported on ${new Date().toLocaleString('ja-JP')}</small>
                </div>
            </div>
        </div>

        <!-- Knowledge Book Overview -->
        <div class="card mb-4 shadow-sm">
            <div class="card-header bg-info text-white">
                <h5 class="mb-0">
                    <i class="bi bi-info-circle me-2"></i>Knowledge Book Overview
                </h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <dl class="row">
                            <dt class="col-sm-4">Created:</dt>
                            <dd class="col-sm-8">${new Date(knowledgeBook.created).toLocaleString('ja-JP')}</dd>
                            <dt class="col-sm-4">Total Results:</dt>
                            <dd class="col-sm-8"><span class="badge bg-primary">${enrichedItems.length}</span></dd>
                            <dt class="col-sm-4">Sources Used:</dt>
                            <dd class="col-sm-8">${Array.isArray(knowledgeBook.sources) ? knowledgeBook.sources.length : (knowledgeBook.sources ? knowledgeBook.sources.split(',').length : 0)}</dd>
                        </dl>
                    </div>
                    <div class="col-md-6">
                        <dl class="row">
                            <dt class="col-sm-4">Knowledge Book ID:</dt>
                            <dd class="col-sm-8"><code>${knowledgeBook.id}</code></dd>
                        </dl>
                    </div>
                </div>
                
                <!-- Sources Used -->
                ${knowledgeBook.resultsBySources && knowledgeBook.resultsBySources.length > 0 ? `
                    <div class="mt-3">
                        <h6>Sources Used:</h6>
                        <div class="mb-2">
                            ${knowledgeBook.resultsBySources.map(sourceInfo => {
                                const sourceClass = this.getSourceClass(sourceInfo.source);
                                return `<span class="badge me-1 ${sourceClass.class}">${sourceInfo.source} (${sourceInfo.count})</span>`;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Knowledge Book Items -->
        <div class="card shadow-sm">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">
                    <i class="bi bi-collection me-2"></i>Knowledge Book Items
                    <span class="badge bg-light text-dark ms-2">${enrichedItems.length}</span>
                    ${enrichedItems.filter(item => item.userMemo && item.userMemo.content).length > 0 ? 
                        `<span class="badge bg-warning text-dark ms-1">
                            <i class="bi bi-sticky me-1"></i>${enrichedItems.filter(item => item.userMemo && item.userMemo.content).length} with memos
                        </span>` : ''}
                </h5>
            </div>
            <div class="card-body">
                ${enrichedItems.map((item, index) => `
                    <div class="search-result-item-list mb-3" data-tags="${item.tags ? item.tags.join(',') : ''}" data-source="${item.source || ''}">
                        <div class="d-flex align-items-start">
                            <div class="flex-grow-1">
                                <h6>
                                    <strong>${index + 1}.</strong>
                                    <span class="clickable-title" onclick="toggleItemDetail(${index})">
                                        ${this.escapeHtml(item.title)}
                                    </span>
                                    ${item.userMemo && item.userMemo.content ? 
                                        `<i class="bi bi-sticky memo-icon ms-2" title="Has user memo"></i>` : ''}
                                </h6>
                                <p class="text-muted mb-2">${this.escapeHtml(item.description || item.summary || item.snippet || '')}</p>
                                
                                <!-- User Memo (if exists) -->
                                ${item.userMemo && item.userMemo.content ? `
                                    <div class="user-memo">
                                        <h6 class="memo-icon mb-2">
                                            <i class="bi bi-sticky me-1"></i>Your Notes:
                                        </h6>
                                        <p class="mb-1">${this.escapeHtml(item.userMemo.content)}</p>
                                        <small class="text-muted">
                                            Last updated: ${new Date(item.userMemo.lastUpdated).toLocaleString('ja-JP')}
                                        </small>
                                    </div>
                                ` : ''}
                                
                                <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
                                    ${item.sourceClass ? `
                                        <small class="text-muted">
                                            <i class="bi bi-globe"></i> 
                                            <span class="badge tag-badge ${item.sourceClass.class}">${item.sourceClass.name}</span>
                                        </small>
                                    ` : ''}
                                    ${item.tags && item.tags.length > 0 ? `
                                        <div class="tags-container">
                                            ${item.tagClasses.map(tag => 
                                                `<span class="badge tag-badge ${tag.class}">${this.escapeHtml(tag.name)}</span>`
                                            ).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                                
                                <!-- Item Detail (Hidden by default) -->
                                <div class="item-detail" id="detail-${index}">
                                    <div class="row">
                                        <div class="col-md-8">
                                            <h6 class="text-primary"><i class="bi bi-info-circle me-1"></i>Item Details</h6>
                                            <table class="table table-sm">
                                                <tr>
                                                    <td><strong>Title:</strong></td>
                                                    <td>${this.escapeHtml(item.title)}</td>
                                                </tr>
                                                ${item.description || item.summary || item.snippet ? `
                                                    <tr>
                                                        <td><strong>Description:</strong></td>
                                                        <td>${this.escapeHtml(item.description || item.summary || item.snippet)}</td>
                                                    </tr>
                                                ` : ''}
                                                ${item.source ? `
                                                    <tr>
                                                        <td><strong>Source:</strong></td>
                                                        <td><span class="badge ${item.sourceClass ? item.sourceClass.class : 'bg-secondary'}">${this.escapeHtml(item.source)}</span></td>
                                                    </tr>
                                                ` : ''}
                                                ${item.url ? `
                                                    <tr>
                                                        <td><strong>External Link:</strong></td>
                                                        <td><a href="${this.escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-primary btn-sm">
                                                            <i class="bi bi-box-arrow-up-right me-1"></i>Open Original Source
                                                        </a></td>
                                                    </tr>
                                                ` : ''}
                                                ${item.authors && item.authors.length > 0 ? `
                                                    <tr>
                                                        <td><strong>Authors:</strong></td>
                                                        <td>${item.authors.slice(0, 3).join(', ')}${item.authors.length > 3 ? ` (+${item.authors.length - 3} more)` : ''}</td>
                                                    </tr>
                                                ` : ''}
                                                ${item.published || item.publishedDate ? `
                                                    <tr>
                                                        <td><strong>Published:</strong></td>
                                                        <td>${item.published || item.publishedDate}</td>
                                                    </tr>
                                                ` : ''}
                                                ${item.language ? `
                                                    <tr>
                                                        <td><strong>Language:</strong></td>
                                                        <td>${this.escapeHtml(item.language)}</td>
                                                    </tr>
                                                ` : ''}
                                            </table>
                                        </div>
                                        <div class="col-md-4">
                                            <h6 class="text-secondary"><i class="bi bi-tags me-1"></i>Tags & Metadata</h6>
                                            ${item.tags && item.tags.length > 0 ? `
                                                <div class="mb-3">
                                                    ${item.tagClasses.map(tag => 
                                                        `<span class="badge tag-badge ${tag.class} me-1 mb-1">${this.escapeHtml(tag.name)}</span>`
                                                    ).join('')}
                                                </div>
                                            ` : ''}
                                            ${item.stars !== undefined ? `<p><strong>Stars:</strong> ⭐ ${item.stars}</p>` : ''}
                                            ${item.forks !== undefined ? `<p><strong>Forks:</strong> 🔀 ${item.forks}</p>` : ''}
                                        </div>
                                    </div>
                                    <div class="text-end mt-2">
                                        <button class="btn btn-outline-secondary btn-sm" onclick="toggleItemDetail(${index})">
                                            <i class="bi bi-x-circle me-1"></i>Close Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ${index < enrichedItems.length - 1 ? '<hr>' : ''}
                `).join('')}
            </div>
        </div>
        
        <!-- Export Info -->
        <div class="mt-4 text-center">
            <div class="card">
                <div class="card-body">
                    <p class="mb-2"><strong>📚 Saphira Knowledge Management System</strong></p>
                    <p class="text-muted mb-0">
                        <small>
                            <i class="bi bi-calendar me-1"></i>Exported on ${new Date().toLocaleString('ja-JP')} | 
                            <i class="bi bi-collection me-1"></i>${enrichedItems.length} items | 
                            <i class="bi bi-search me-1"></i>Query: "${this.escapeHtml(knowledgeBook.query || '')}"
                            ${enrichedItems.filter(item => item.userMemo && item.userMemo.content).length > 0 ? 
                                ` | <i class="bi bi-sticky me-1"></i>${enrichedItems.filter(item => item.userMemo && item.userMemo.content).length} items with memos` : ''}
                        </small>
                    </p>
                </div>
            </div>
        </div>
    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Toggle item detail display
        function toggleItemDetail(index) {
            const detail = document.getElementById('detail-' + index);
            if (detail.classList.contains('show')) {
                detail.classList.remove('show');
            } else {
                // Close all other details
                document.querySelectorAll('.item-detail').forEach(d => d.classList.remove('show'));
                // Show this detail
                detail.classList.add('show');
                // Scroll to detail
                detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        // Close all details when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.search-result-item-list') && !e.target.closest('.clickable-title')) {
                document.querySelectorAll('.item-detail').forEach(d => d.classList.remove('show'));
            }
        });
        
        // Add some interactive effects
        document.addEventListener('DOMContentLoaded', function() {
            console.log('📚 Saphira Knowledge Book HTML Export loaded');
            console.log('💡 Click on item titles to view detailed information');
            const memoCount = ${enrichedItems.filter(item => item.userMemo && item.userMemo.content).length};
            if (memoCount > 0) {
                console.log('📝 This Knowledge Book contains ' + memoCount + ' user memos');
            }
        });
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * Knowledge Book統計情報を表示用にフォーマット
   * @param {Object} data - Knowledge Book データまたはライブラリ統計データ
   * @returns {Object} 表示用統計情報
   */
  formatStatsForDisplay(data) {
    // Knowledge Book データの場合
    if (data.results || data.items) {
      const items = data.results || data.items || [];
      
      // ソース別統計
      const sourceStats = {};
      items.forEach(item => {
        if (item.source) {
          sourceStats[item.source] = (sourceStats[item.source] || 0) + 1;
        }
      });

      // タグ別統計
      const tagStats = {};
      items.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach(tag => {
            tagStats[tag] = (tagStats[tag] || 0) + 1;
          });
        }
      });

      // メモ付きアイテム数
      const itemsWithMemos = items.filter(item => item.userMemo && item.userMemo.content).length;

      // ソース別統計を配列に変換してソート
      const resultsBySources = Object.entries(sourceStats)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      // タグ統計を配列に変換してソート（上位10件）
      const topTags = Object.entries(tagStats)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalItems: items.length,
        itemsWithMemos,
        uniqueSources: Object.keys(sourceStats).length,
        uniqueTags: Object.keys(tagStats).length,
        resultsBySources,
        topTags,
        sourceStats,
        tagStats
      };
    }
    
    // ライブラリ統計データの場合
    if (data.totalItems !== undefined || data.categories || data.sources) {
      // Categories display data
      const categoriesDisplay = Object.entries(data.categories || {})
        .map(([category, count]) => ({
          name: category,
          count: count,
          url: `/library?category=${encodeURIComponent(category)}`,
          class: this.getTagClasses([category])[0]?.class || 'bg-secondary'
        }))
        .sort((a, b) => b.count - a.count);

      // Sources display data
      const sourcesDisplay = Object.entries(data.sources || {})
        .map(([source, count]) => ({
          name: source,
          count: count,
          url: `/library?source=${encodeURIComponent(source)}`,
          class: this.getSourceClass(source).class || 'bg-primary'
        }))
        .sort((a, b) => b.count - a.count);
      
      // Search keywords display data
      const searchKeywordsDisplay = Object.entries(data.searchKeywords || {})
        .map(([keyword, count]) => ({
          name: keyword,
          count: count,
          url: `/library?q=${encodeURIComponent(keyword)}`
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Recent items with enriched data
      const recentItemsDisplay = (data.recentItems || []).map(item => ({
        ...item,
        tagClasses: this.getTagClasses(item.tags || []),
        sourceClass: this.getSourceClass(item.source)
      }));

      return {
        totalItems: data.totalItems || 0,
        totalKnowledgeBooks: data.totalKnowledgeBooks || 0,
        categories: data.categories || {},
        sources: data.sources || {},
        searchKeywords: data.searchKeywords || {},
        recentItems: data.recentItems || [],
        // Display data for templates
        categoriesDisplay,
        sourcesDisplay,
        searchKeywordsDisplay,
        recentItemsDisplay,
        // Knowledge Book format compatibility
        uniqueSources: Object.keys(data.sources || {}).length,
        uniqueTags: Object.keys(data.categories || {}).length,
        resultsBySources: Object.entries(data.sources || {})
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count),
        topTags: Object.entries(data.categories || {})
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      };
    }
    
    // デフォルト値
    return {
      totalItems: 0,
      itemsWithMemos: 0,
      uniqueSources: 0,
      uniqueTags: 0,
      resultsBySources: [],
      topTags: [],
      sourceStats: {},
      tagStats: {}
    };
  }

  /**
   * HTMLエスケープ処理
   * @param {string} text - エスケープするテキスト
   * @returns {string} エスケープ済みテキスト
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * HTMLファイルを保存
   * @param {string} html - HTMLコンテンツ
   * @param {string} filename - ファイル名
   * @param {string} directory - 保存ディレクトリ
   * @returns {Promise<string>} 保存されたファイルパス
   */
  async saveHTMLFile(html, filename, directory) {
    try {
      // ディレクトリが存在しない場合は作成
      await fs.mkdir(directory, { recursive: true });
      
      const filePath = path.join(directory, filename);
      await fs.writeFile(filePath, html, 'utf8');
      
      this.logger.info(`HTML exported to: ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error('Failed to save HTML file:', error);
      throw error;
    }
  }
}

module.exports = KnowledgeItemRenderer;
