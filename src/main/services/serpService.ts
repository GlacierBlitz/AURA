/**
 * SerpService - Handles SerpAPI calls for search suggestions and autocomplete
 * Uses SerpAPI (https://serpapi.com) for search results
 */

export interface SerpAutocompleteResponse {
  suggestions: string[];
}

export class SerpService {
  private apiKey: string | null = null;
  private readonly SERPAPI_BASE = 'https://serpapi.com/search';
  private readonly REQUEST_TIMEOUT = 8000; // 8 second timeout

  /**
   * Configure the SerpAPI key
   */
  configure(apiKey: string): void {
    this.apiKey = apiKey?.trim() || null;
    console.log(`[SerpAPI] Configured with key: ${this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'none'}`);
  }

  /**
   * Check if SerpAPI is configured
   */
  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  /**
   * Get search suggestions using SerpAPI
   */
  async getAutocomplete(query: string): Promise<SerpAutocompleteResponse> {
    if (!this.isConfigured()) {
      console.error('[SerpAPI] API not configured. SERP_API_KEY is missing or empty.');
      return { suggestions: [] };
    }

    if (!query || query.trim().length === 0) {
      return { suggestions: [] };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      console.log(`[SerpAPI] Fetching suggestions for: "${query}"`);

      // Clean the API key
      const cleanApiKey = (this.apiKey || '').trim().replace(/^["']|["']$/g, '');
      
      // Build URL with query parameters for SerpAPI
      const params = new URLSearchParams({
        api_key: cleanApiKey,
        q: query,
        engine: 'google',
        num: '10',
      });

      const response = await fetch(`${this.SERPAPI_BASE}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const statusCode = response.status;
      console.log(`[SerpAPI] Response status: ${statusCode}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SerpAPI] HTTP ${statusCode} ${response.statusText}`);
        console.error(`[SerpAPI] Response:`, errorText);
        
        if (statusCode === 401 || statusCode === 403) {
          console.error('[SerpAPI] Authentication failed - Check your API key');
        } else if (statusCode === 429) {
          console.error('[SerpAPI] Rate limited - Too many requests');
        }
        
        return { suggestions: [] };
      }

      const data = await response.json();
      console.log(`[SerpAPI] Got response with keys:`, Object.keys(data));
      
      const suggestions: string[] = [];
      
      // Extract from related questions
      if (data.related_questions && Array.isArray(data.related_questions)) {
        console.log(`[SerpAPI] Found ${data.related_questions.length} related questions`);
        suggestions.push(...data.related_questions.slice(0, 5).map((item: any) => item.question));
      }
      
      // Extract related searches (if available)
      if (data.related_searches && Array.isArray(data.related_searches)) {
        console.log(`[SerpAPI] Found ${data.related_searches.length} related searches`);
        suggestions.push(...data.related_searches.map((item: any) => item.query));
      }
      
      // Extract from answer box if available
      if (suggestions.length < 3 && data.answer_box && data.answer_box.answer) {
        console.log('[SerpAPI] Adding answer box answer');
        suggestions.push(data.answer_box.answer);
      }
      
      // Extract from knowledge graph
      if (suggestions.length < 3 && data.knowledge_graph) {
        console.log('[SerpAPI] Using knowledge graph data');
        const kg = data.knowledge_graph;
        if (kg.title) suggestions.push(kg.title);
        if (kg.description) suggestions.push(kg.description.substring(0, 100));
      }
      
      // Extract from organic results titles
      if (suggestions.length < 3 && data.organic_results && Array.isArray(data.organic_results)) {
        console.log(`[SerpAPI] Extracting from ${Math.min(3, data.organic_results.length)} organic results`);
        suggestions.push(...data.organic_results.slice(0, 3).map((item: any) => item.title));
      }
      
      // Last resort: return the query
      if (suggestions.length === 0) {
        console.log('[SerpAPI] No suggestions found, using query as fallback');
        suggestions.push(query);
      }
      
      console.log(`[SerpAPI] Returning ${suggestions.length} suggestion(s)`);
      return {
        suggestions: suggestions.filter(s => s && s.length > 0).slice(0, 8),
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('[SerpAPI] Request timeout');
      } else {
        console.error('[SerpAPI] Request failed:', error.message);
      }
      return { suggestions: [] };
    }
  }
}
