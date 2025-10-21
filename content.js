// content.js — Doucite v4.2.1 - APA Compliance Edition
// Fixed corporate author handling and APA 7 formatting

(function () {
  'use strict';

  // Enhanced utility functions
  const text = el => (el && el.textContent ? el.textContent.trim() : "");
  const attr = (el, n) => (el ? el.getAttribute(n) || "" : "");
  const normalize = s => String(s || "").replace(/\s+/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  
  const safeQuery = (selector, root = document) => {
    try { 
      return Array.from((root || document).querySelectorAll(selector)); 
    } catch { 
      return []; 
    }
  };

  // Comprehensive selector database
  const SELECTORS = {
    article: [
      'article', 'main', '.article', '.post', '.post-content', '.entry-content', 
      '.content', '.main-content', '#content', '.article-body', '.page-content', 
      '[role="main"]', '.story', '.story-body', '.article-content', '.post-body'
    ],
    
    byline: {
      highConfidence: [
        '[data-testid="author-name"]',
        '[data-qa="author-name"]',
        '.author-details .name',
        '.article-author__name',
        '.byline__author',
        '[rel="author"]',
        '[itemprop="author"] [itemprop="name"]',
        '.author-name',
        '.entry-author',
        '.author__name',
        '.contributor__name',
        '.article-byline__author'
      ],
      mediumConfidence: [
        '.byline',
        '.author',
        '.article-author',
        '.article-meta__byline',
        '.post-author',
        '.contributor',
        '.article-meta .author',
        '.author-meta',
        '.article-header .author'
      ],
      lowConfidence: [
        '.meta .author',
        'header .author',
        'footer .author',
        '.credit',
        '.caption .author'
      ]
    },
    
    date: [
      'time[datetime]',
      '[data-published]',
      '[data-modified]',
      '.published',
      '.date-published',
      '.article-date',
      '.post-date',
      '.entry-date',
      '.publish-date',
      '[itemprop="datePublished"]'
    ]
  };

  // Enhanced validation patterns
  const PATTERNS = {
    photoCredit: /\b(photo|photograph|image|credit|shot|photographer|photos? by|images? by|credit:)\s*(?:[^a-z0-9]|$)/i,
    provenance: /\b(NPR|WBUR|NSIDC|NOAA|EPA|AP|Reuters|PBS|CNN|BBC|CBS|NBC|ABC|Fox News|Associated Press|Reuters)\b/i,
    organization: new RegExp([
      'center', 'centre', 'laboratory', 'lab', 'observatory', 'department', 'division',
      'office', 'program', 'team', 'staff', 'group', 'agency', 'university', 'institute',
      'project', 'service', 'board', 'hub', 'company', 'corporation', 'authority', 'bureau',
      'ministry', 'commission', 'committee', 'foundation', 'organization', 'association',
      'administration', 'society', 'network', 'alliance', 'coalition'
    ].join('|'), 'i'),
    
    nonPerson: new RegExp([
      'all news', 'newsroom', 'news team', 'our team', 'editorial', 'press release', 'pressroom',
      'contributors', 'topics', 'topic', 'section', 'business', 'sector', 'mission',
      'melting', 'sea', 'ice', 'climate', 'report', 'card', 'drivers', 'causes', 'overview',
      'background', 'summary', 'findings', 'analysis', 'commentary', 'opinion', 'blog',
      'update', 'alert', 'notification', 'announcement', 'media', 'coverage', 'transcript',
      'podcast', 'video', 'audio', 'gallery', 'photos', 'images', 'multimedia'
    ].join('|'), 'i'),
    
    nameFormat: {
      basic: /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/,
      withMiddle: /^[A-Z][a-z]+(?:\s+[A-Z](?:\.|[a-z]+))+\s+[A-Z][a-z]+$/,
      withSuffix: /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+(?:Jr\.|Sr\.|III|IV|II|I)$/i,
      withPrefix: /^(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i,
      lastNameFirst: /^[A-Z][a-z]+,\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]*)?$/
    }
  };

  // Enhanced corporate author mapping with APA-compliant names
  const CORPORATE_AUTHORS = {
    'epa.gov': {
      full: 'U.S. Environmental Protection Agency',
      abbreviation: 'EPA',
      apaName: 'U.S. Environmental Protection Agency'
    },
    'noaa.gov': {
      full: 'National Oceanic and Atmospheric Administration', 
      abbreviation: 'NOAA',
      apaName: 'National Oceanic and Atmospheric Administration'
    },
    'climate.gov': {
      full: 'NOAA Climate.gov',
      abbreviation: 'NOAA',
      apaName: 'National Oceanic and Atmospheric Administration'
    },
    'npr.org': {
      full: 'NPR',
      abbreviation: 'NPR',
      apaName: 'NPR'
    },
    'who.int': {
      full: 'World Health Organization',
      abbreviation: 'WHO',
      apaName: 'World Health Organization'
    },
    'cdc.gov': {
      full: 'Centers for Disease Control and Prevention',
      abbreviation: 'CDC',
      apaName: 'Centers for Disease Control and Prevention'
    },
    'nsidc.org': {
      full: 'National Snow and Ice Data Center',
      abbreviation: 'NSIDC',
      apaName: 'National Snow and Ice Data Center'
    },
    'wbur.org': {
      full: 'WBUR',
      abbreviation: 'WBUR',
      apaName: 'WBUR'
    }
  };

  // Enhanced name validation with multiple layers
  function validateNameCandidate(name) {
    if (!name || typeof name !== 'string') return false;
    
    const clean = normalize(name)
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/['"`]/g, '')
      .replace(/[,.;:—–…]+$/g, '')
      .trim();
    
    // Length validation
    if (clean.length < 4 || clean.length > 80) return false;
    
    // Pattern blacklists
    if (PATTERNS.photoCredit.test(clean)) return false;
    if (PATTERNS.provenance.test(clean)) return false;
    if (PATTERNS.organization.test(clean)) return false;
    if (PATTERNS.nonPerson.test(clean)) return false;
    
    // Check for common false positives
    const lowerClean = clean.toLowerCase();
    const falsePositives = [
      'news', 'team', 'staff', 'editorial', 'press', 'media', 'video', 'audio',
      'photo', 'image', 'credit', 'update', 'alert', 'breaking', 'live'
    ];
    if (falsePositives.some(fp => lowerClean.includes(fp))) return false;
    
    // Structural validation
    const tokens = clean.split(/\s+/).filter(t => t.length > 0);
    if (tokens.length < 2 || tokens.length > 5) return false;
    
    // Name pattern matching
    const testString = clean.replace(/[.,]/g, '');
    const matchesPattern = Object.values(PATTERNS.nameFormat).some(pattern => 
      pattern.test(testString)
    );
    
    if (!matchesPattern) return false;
    
    // Token quality check
    const validTokens = tokens.filter(token => {
      if (token.length === 1 && /[A-Z]/.test(token)) return true; // Initial
      if (/^(?:[A-Z]\.|[a-z]{2,})$/i.test(token)) return true;
      if (/^(?:Jr\.|Sr\.|III|IV|II|I)$/i.test(token)) return true;
      if (/^[A-Z][a-z]+$/.test(token)) return true;
      return false;
    });
    
    return validTokens.length >= 2;
  }

  // Enhanced organization detection
  function isLikelyOrganization(name) {
    const clean = String(name || "").trim();
    if (!clean) return true;
    
    // Quick length check
    if (clean.length < 3) return true;
    
    // Check against non-person patterns
    if (PATTERNS.nonPerson.test(clean)) return true;
    
    // Organization indicators
    const orgIndicators = [
      'all things considered', 'morning edition', 'weekend edition', 'evening edition',
      'on air', 'broadcast', 'program', 'show', 'segment', 'edition', 'news',
      'center', 'department', 'agency', 'institute', 'administration', 'authority',
      'government', 'organization', 'committee', 'association', 'university', 'team',
      'group', 'office', 'board', 'foundation', 'corporation', 'company', 'society',
      'commission', 'service', 'project', 'bureau', 'ministry', 'network', 'alliance'
    ];
    
    if (orgIndicators.some(indicator => clean.toLowerCase().includes(indicator))) {
      return true;
    }
    
    // All caps check (except for short names)
    if (/^[A-Z\s]{5,}$/.test(clean) && clean.length > 4) return true;
    
    // Multiple capitalized words (likely organization names)
    const words = clean.split(/\s+/);
    if (words.length >= 3 && words.every(w => /^[A-Z][a-z]*$/.test(w))) return true;
    
    // Two-word patterns that are typically organizations
    if (words.length === 2) {
      const [first, second] = words;
      if (/^(edition|segment|program|show|broadcast)$/i.test(second)) return true;
      if (/^[A-Z]{2,}$/.test(first) && /^[A-Z][a-z]+$/.test(second)) return true;
    }
    
    // Single word all caps (acronyms)
    if (words.length === 1 && /^[A-Z]{3,}$/.test(clean)) return true;
    
    return false;
  }

  // Enhanced author parsing with better error handling
  function parseAuthorText(rawText) {
    if (!rawText) return [];
    
    let text = normalize(rawText)
      .replace(/^\s*By[:\s]+/i, '')
      .replace(/\b(?:Written by|Authored by|Reported by|Byline:|Contributors?:)\s*/gi, '')
      .replace(/\b(?:From|Heard on|Reviewed by|Produced by|Edited by)\b.*$/i, '')
      .trim();

    // Early rejection for obvious non-author content
    if (PATTERNS.nonPerson.test(text) || isLikelyOrganization(text)) {
      return [];
    }

    // Clean leading/trailing punctuation
    text = text.replace(/^[,;:.\/\s]+|[,;:.\/\s]+$/g, '');

    const cleanPart = p => String(p || "").replace(/^[,;:.\/\s]+|[,;:.\/\s]+$/g, '').replace(/\s+/g, ' ').trim();

    // Strategy priority: Try most structured formats first
    const strategies = [
      // Strategy 1: Comma-separated (Last, First format)
      text => {
        if (/,/.test(text) && !isLikelyOrganization(text)) {
          const parts = text.split(/\s*,\s*/).map(cleanPart).filter(Boolean);
          if (parts.length === 2 && PATTERNS.nameFormat.lastNameFirst.test(text)) {
            return [`${parts[1]} ${parts[0]}`];
          } else if (parts.length > 1 && parts.length <= 5) {
            return parts.filter(author => validateNameCandidate(author));
          }
        }
        return null;
      },
      
      // Strategy 2: "and"/"&" separated
      text => {
        if (/\s+(and|&)\s+/i.test(text)) {
          const parts = text.split(/\s+(?:and|&)\s+/i).map(cleanPart).filter(Boolean);
          if (parts.length > 1 && parts.length <= 5) {
            return parts.filter(author => validateNameCandidate(author));
          }
        }
        return null;
      },
      
      // Strategy 3: Slash-separated
      text => {
        if (/\s*\/\s*/.test(text)) {
          const parts = text.split(/\s*\/\s*/).map(cleanPart).filter(Boolean);
          if (parts.length > 1 && parts.length <= 3) {
            return parts.filter(author => validateNameCandidate(author));
          }
        }
        return null;
      },
      
      // Strategy 4: Semicolon separated
      text => {
        if (/;/.test(text)) {
          const parts = text.split(/\s*;\s*/).map(cleanPart).filter(Boolean);
          if (parts.length > 1 && parts.length <= 5) {
            return parts.filter(author => validateNameCandidate(author));
          }
        }
        return null;
      },
      
      // Strategy 5: Pipe separated
      text => {
        if (/\|/.test(text)) {
          const parts = text.split(/\s*\|\s*/).map(cleanPart).filter(Boolean);
          if (parts.length > 1 && parts.length <= 5) {
            return parts.filter(author => validateNameCandidate(author));
          }
        }
        return null;
      },
      
      // Strategy 6: Line break separated
      text => {
        if (/\n/.test(text)) {
          const parts = text.split(/\r?\n/).map(cleanPart).filter(a => a && a.length > 1);
          if (parts.length > 1 && parts.length <= 5) {
            return parts.filter(author => validateNameCandidate(author));
          }
        }
        return null;
      }
    ];

    // Try each strategy in order
    for (const strategy of strategies) {
      const result = strategy(text);
      if (result && result.length > 0) {
        return result;
      }
    }

    // Fallback: treat as single author if valid
    const single = cleanPart(text);
    if (validateNameCandidate(single)) {
      return [single];
    }

    return [];
  }

  // Enhanced multi-source extraction with better error handling
  function extractAuthorsMultiSource() {
    const sources = [];
    
    try {
      // Source 1: Structured data (highest priority)
      const structuredAuthors = extractStructuredAuthors();
      if (structuredAuthors.persons.length > 0) {
        sources.push({
          type: 'structured',
          authors: structuredAuthors.persons,
          confidence: 'high'
        });
      }
      
      // Source 2: High-confidence selectors
      SELECTORS.byline.highConfidence.forEach(selector => {
        safeQuery(selector).forEach(element => {
          if (!isElementVisible(element)) return;
          
          const parsed = parseAuthorText(text(element)).map(a => a.trim()).filter(Boolean);
          const authors = deduplicateAuthors(parsed);
          
          if (authors.length > 0) {
            sources.push({
              type: 'high_confidence_selector',
              selector,
              authors,
              confidence: 'high',
              element: element
            });
          }
        });
      });
      
      // Source 3: Medium-confidence selectors
      SELECTORS.byline.mediumConfidence.forEach(selector => {
        safeQuery(selector).forEach(element => {
          if (!isElementVisible(element)) return;
          
          const parsed = parseAuthorText(text(element)).map(a => a.trim()).filter(Boolean);
          const authors = deduplicateAuthors(parsed);
          
          if (authors.length > 0) {
            sources.push({
              type: 'medium_confidence_selector',
              selector,
              authors,
              confidence: 'medium',
              element: element
            });
          }
        });
      });
      
      // Source 4: Contextual analysis
      const contextualAuthors = extractContextualAuthors();
      if (contextualAuthors.length > 0) {
        sources.push({
          type: 'contextual',
          authors: contextualAuthors,
          confidence: 'medium'
        });
      }
    } catch (error) {
      console.warn('Doucite: Error in multi-source extraction', error);
    }
    
    return sources;
  }

  // Deduplicate authors array
  function deduplicateAuthors(authors) {
    const seen = new Set();
    const unique = [];
    
    authors.forEach(author => {
      const key = normalize(author).toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(author);
      }
    });
    
    return unique;
  }

  // Enhanced structured data extraction
  function extractStructuredAuthors() {
    const authors = new Set();
    
    // Meta tags
    const metaSelectors = [
      'meta[name="author"]',
      'meta[name="citation_author"]',
      'meta[property="article:author"]',
      'meta[name="dc.creator"]',
      'meta[property="books:author"]'
    ];
    
    metaSelectors.forEach(selector => {
      safeQuery(selector).forEach(meta => {
        const content = attr(meta, 'content');
        if (content) {
          parseAuthorText(content).forEach(author => authors.add(author));
        }
      });
    });
    
    // JSON-LD with enhanced parsing
    safeQuery('script[type="application/ld+json"]').forEach(script => {
      try {
        const data = JSON.parse(text(script));
        const processEntity = entity => {
          if (!entity) return;
          
          const authorFields = ['author', 'creator', 'contributor', 'writer'];
          authorFields.forEach(field => {
            const value = entity[field];
            if (!value) return;
            
            if (typeof value === 'string') {
              parseAuthorText(value).forEach(author => authors.add(author));
            } else if (Array.isArray(value)) {
              value.forEach(item => {
                if (typeof item === 'string') {
                  parseAuthorText(item).forEach(author => authors.add(author));
                } else if (item && item.name) {
                  parseAuthorText(item.name).forEach(author => authors.add(author));
                }
              });
            } else if (value && value.name) {
              parseAuthorText(value.name).forEach(author => authors.add(author));
            }
          });
        };
        
        if (Array.isArray(data)) {
          data.forEach(processEntity);
        } else {
          processEntity(data);
        }
      } catch (e) {
        // Silent fail for invalid JSON
      }
    });
    
    // Microdata
    safeQuery('[itemprop="author"]').forEach(element => {
      const nameElement = element.querySelector('[itemprop="name"]') || element;
      parseAuthorText(text(nameElement)).forEach(author => authors.add(author));
    });
    
    const allAuthors = Array.from(authors);
    return {
      all: allAuthors,
      persons: allAuthors.filter(validateNameCandidate)
    };
  }

  // Enhanced contextual author extraction
  function extractContextualAuthors() {
    const authors = new Set();
    const articleContainer = findArticleContainer();
    
    if (!articleContainer) return [];
    
    const titleElement = findArticleHeader();
    if (!titleElement) return [];
    
    try {
      const walker = document.createTreeWalker(
        articleContainer,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) {
              return NodeFilter.FILTER_REJECT;
            }
            if (node.parentElement.closest('script, style, noscript, head, nav, footer, aside')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );
      
      let node;
      while ((node = walker.nextNode())) {
        const textContent = node.nodeValue.trim();
        if (textContent.length > 5 && textContent.length < 100) {
          const extracted = parseAuthorText(textContent);
          extracted.forEach(author => {
            if (isElementNearTitle(node.parentElement, titleElement)) {
              authors.add(author);
            }
          });
        }
      }
    } catch (error) {
      console.warn('Doucite: Error in contextual extraction', error);
    }
    
    return Array.from(authors);
  }

  function isElementNearTitle(element, titleElement, maxDistance = 300) {
    if (!element || !titleElement) return false;
    
    try {
      const elemRect = element.getBoundingClientRect();
      const titleRect = titleElement.getBoundingClientRect();
      
      const verticalDistance = Math.abs(elemRect.top - titleRect.bottom);
      return verticalDistance <= maxDistance;
    } catch {
      return false;
    }
  }

  // Enhanced container finding
  function findArticleContainer() {
    for (const selector of SELECTORS.article) {
      const element = document.querySelector(selector);
      if (element && isElementVisible(element)) {
        return element;
      }
    }
    
    // Fallback: Find largest text block
    const candidates = safeQuery('div, main, article, section').filter(isElementVisible);
    if (candidates.length > 0) {
      candidates.sort((a, b) => (b.textContent || '').length - (a.textContent || '').length);
      return candidates[0];
    }
    
    return document.body;
  }

  function isElementVisible(element) {
    if (!element) return false;
    if (element.offsetParent === null) return false;
    if (element.getClientRects().length === 0) return false;
    
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }

  function findArticleHeader() {
    const h1 = document.querySelector('h1');
    if (h1 && isElementVisible(h1)) return h1;
    
    const headerSelectors = [
      '.article-header h1',
      '.post-title h1',
      '.entry-title h1',
      '.headline h1',
      '.title h1',
      'header h1',
      'h1[itemprop="headline"]',
      '[role="heading"][aria-level="1"]'
    ];
    
    for (const selector of headerSelectors) {
      const element = document.querySelector(selector);
      if (element && isElementVisible(element)) return element;
    }
    
    return null;
  }

  // Enhanced corporate author inference with APA compliance
  function inferCorporateAuthor() {
    const hostname = window.location.hostname.toLowerCase();
    
    // Check exact domain matches first
    for (const [domain, authorInfo] of Object.entries(CORPORATE_AUTHORS)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return {
          name: authorInfo.apaName,
          full: authorInfo.full,
          abbreviation: authorInfo.abbreviation,
          source: 'corporate_domain'
        };
      }
    }
    
    // Fallback for other .gov domains
    if (/\.gov\b/.test(hostname)) {
      const agency = hostname.split('.')[0];
      const agencyMap = {
        'epa': { name: 'U.S. Environmental Protection Agency', abbr: 'EPA' },
        'noaa': { name: 'National Oceanic and Atmospheric Administration', abbr: 'NOAA' },
        'cdc': { name: 'Centers for Disease Control and Prevention', abbr: 'CDC' },
        'nih': { name: 'National Institutes of Health', abbr: 'NIH' },
        'nasa': { name: 'National Aeronautics and Space Administration', abbr: 'NASA' }
      };
      
      if (agencyMap[agency.toLowerCase()]) {
        const info = agencyMap[agency.toLowerCase()];
        return {
          name: info.name,
          full: info.name,
          abbreviation: info.abbr,
          source: 'government_domain'
        };
      }
      
      // Generic government agency
      return {
        name: agency.toUpperCase(),
        full: agency.toUpperCase(),
        abbreviation: agency.toUpperCase(),
        source: 'generic_government'
      };
    }
    
    return null;
  }

  // Enhanced author resolution with confidence scoring
  function resolveAuthors(authorSources) {
    const authorScores = new Map();
    
    authorSources.forEach(source => {
      const confidenceWeight = {
        high: 3,
        medium: 2,
        low: 1
      }[source.confidence] || 1;
      
      source.authors.forEach(author => {
        const normalizedAuthor = normalize(author);
        const currentScore = authorScores.get(normalizedAuthor) || 0;
        authorScores.set(normalizedAuthor, currentScore + confidenceWeight);
      });
    });
    
    // Filter and sort authors
    const scoredAuthors = Array.from(authorScores.entries())
      .filter(([author, score]) => score >= 2 && validateNameCandidate(author))
      .sort((a, b) => b[1] - a[1])
      .map(([author]) => author);
    
    return deduplicateAuthors(scoredAuthors);
  }

  // Main extraction function with comprehensive fallback strategy
  function extractWithFallback() {
    try {
      // Primary extraction
      const authorSources = extractAuthorsMultiSource();
      let resolvedAuthors = resolveAuthors(authorSources);

      // Final cleanup
      resolvedAuthors = resolvedAuthors.map(a => a.trim().replace(/[,;]+$/, ''));
      resolvedAuthors = deduplicateAuthors(resolvedAuthors);

      if (resolvedAuthors.length > 0) {
        return {
          authors: resolvedAuthors,
          source: 'multi_source_resolution',
          confidence: 'high'
        };
      }

      // Fallback strategies
      const fallbackResults = attemptFallbackStrategies();
      if (fallbackResults.authors.length > 0) {
        return {
          authors: fallbackResults.authors,
          source: fallbackResults.source,
          confidence: 'medium'
        };
      }

      return {
        authors: [],
        source: 'no_authors_found',
        confidence: 'none'
      };
      
    } catch (error) {
      console.warn('Doucite extraction error:', error);
      return {
        authors: [],
        source: 'error',
        confidence: 'none',
        error: error.message
      };
    }
  }

  function attemptFallbackStrategies() {
    // Strategy 1: Domain-based corporate authors
    const corporateAuthor = inferCorporateAuthor();
    if (corporateAuthor) {
      return {
        authors: [corporateAuthor.name],
        source: 'corporate_inference',
        corporateData: corporateAuthor
      };
    }
    
    // Strategy 2: Publisher from meta
    const publisher = extractPublisher();
    if (publisher && !isLikelyOrganization(publisher)) {
      return {
        authors: [publisher],
        source: 'publisher_fallback'
      };
    }
    
    return { authors: [], source: 'no_fallback' };
  }

  function extractPublisher() {
    // Try multiple publisher sources
    const publisherSources = [
      () => {
        const meta = document.querySelector('meta[property="og:site_name"]');
        return meta ? attr(meta, 'content') : null;
      },
      () => {
        try {
          const ldScript = document.querySelector('script[type="application/ld+json"]');
          if (ldScript) {
            const data = JSON.parse(text(ldScript));
            const publisher = data.publisher || (data.publisher && data.publisher.name);
            return publisher || null;
          }
        } catch (e) {}
        return null;
      },
      () => {
        const meta = document.querySelector('meta[name="application-name"]');
        return meta ? attr(meta, 'content') : null;
      }
    ];
    
    for (const source of publisherSources) {
      const publisher = source();
      if (publisher) return publisher;
    }
    
    return document.location.hostname.replace(/^www\./, '');
  }

  // Enhanced date extraction
  function extractDate() {
    const dateSources = [];
    
    // Structured data first
    const structuredSelectors = [
      'meta[property="article:published_time"]',
      'meta[name="published_date"]',
      'meta[name="date"]',
      'time[datetime]',
      '[itemprop="datePublished"]'
    ];
    
    structuredSelectors.forEach(selector => {
      safeQuery(selector).forEach(el => {
        const date = attr(el, 'content') || attr(el, 'datetime');
        if (date) {
          dateSources.push({ 
            date: normalize(date), 
            source: 'structured', 
            confidence: 'high' 
          });
        }
      });
    });
    
    // Visible dates
    SELECTORS.date.forEach(selector => {
      safeQuery(selector).forEach(el => {
        const dateText = text(el);
        if (dateText) {
          dateSources.push({ 
            date: normalize(dateText), 
            source: 'visible', 
            confidence: 'medium', 
            element: el 
          });
        }
      });
    });
    
    // Return the highest confidence date
    return dateSources.sort((a, b) => {
      const confidenceScore = { high: 3, medium: 2, low: 1 };
      return (confidenceScore[b.confidence] || 0) - (confidenceScore[a.confidence] || 0);
    })[0] || { date: '', source: 'none', confidence: 'none' };
  }

  // Enhanced DOI extraction
  function extractDOI() {
    // Meta tags
    const metaSelectors = [
      'meta[name="citation_doi"]',
      'meta[name="doi"]',
      'meta[property="og:doi"]',
      'meta[name="DC.identifier"]'
    ];
    
    for (const selector of metaSelectors) {
      const meta = document.querySelector(selector);
      if (meta) {
        const val = attr(meta, 'content');
        if (val) {
          const doi = val.replace(/^doi:/i, '').trim();
          if (doi) return doi;
        }
      }
    }
    
    // JSON-LD
    try {
      const ldScript = document.querySelector('script[type="application/ld+json"]');
      if (ldScript) {
        const data = JSON.parse(text(ldScript));
        const doi = data.doi || 
                   (data.identifier && typeof data.identifier === "string" && 
                    data.identifier.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i));
        if (doi) return Array.isArray(doi) ? doi[0] : doi;
      }
    } catch (e) {}
    
    return "";
  }

  // Main execution with comprehensive error handling
  function executeExtraction() {
    let result;
    
    try {
      const authorResult = extractWithFallback();
      const dateResult = extractDate();
      const title = findArticleHeader() ? text(findArticleHeader()) : document.title;
      const publisher = extractPublisher();
      const doi = extractDOI();

      // Include corporate author data for APA formatting
      const corporateData = authorResult.corporateData || 
                           (authorResult.source === 'corporate_inference' ? inferCorporateAuthor() : null);

      result = {
        title: normalize(title),
        authors: authorResult.authors || [],
        authorSource: authorResult.source || 'unknown',
        authorConfidence: authorResult.confidence || 'none',
        publishedDate: normalize(dateResult.date),
        dateSource: dateResult.source || 'none',
        dateConfidence: dateResult.confidence || 'none',
        publisher: normalize(publisher),
        url: canonicalURL(),
        doi: doi,
        corporateAuthor: corporateData,
        timestamp: new Date().toISOString(),
        version: '4.2.1'
      };
    } catch (error) {
      result = {
        title: '',
        authors: [],
        authorSource: 'error',
        authorConfidence: 'none',
        publishedDate: '',
        dateSource: 'error',
        dateConfidence: 'none',
        publisher: '',
        url: canonicalURL(),
        doi: '',
        error: error.message,
        timestamp: new Date().toISOString(),
        version: '4.2.1'
      };
    }
    
    return result;
  }

  function canonicalURL() {
    try {
      const canonical = document.querySelector('link[rel="canonical"]');
      const url = new URL(canonical ? attr(canonical, 'href') : window.location.href);
      
      // Clean tracking parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'msclkid', 'trk', 'mc_cid', 'mc_eid',
        'utm_id', 'utm_source_platform', 'utm_reader'
      ];
      trackingParams.forEach(param => url.searchParams.delete(param));
      
      return url.toString();
    } catch {
      return window.location.href;
    }
  }

  // Export results with messaging support
  try {
    const result = executeExtraction();
    window.__DOUCITE__ = result;

    // Chrome extension messaging
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'GET_CITATION_DATA') {
          sendResponse({ ok: true, data: window.__DOUCITE__ });
        }
        return true; // Keep message channel open for async response
      });
    }

  } catch (error) {
    window.__DOUCITE__ = {
      title: '',
      authors: [],
      authorSource: 'error',
      authorConfidence: 'none',
      publishedDate: '',
      dateSource: 'error',
      dateConfidence: 'none',
      publisher: '',
      url: window.location.href,
      error: error.message,
      timestamp: new Date().toISOString(),
      version: '4.2.1'
    };
  }
})();