export function parseAdSource(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const params = url.searchParams;

    return {
      source_url: rawUrl,
      // Map UTM params to your specific database columns
      quote_source: params.get('utm_source') || 'Direct',
      campaign_source: params.get('utm_campaign') || params.get('gad_campaignid') || null,
      term_source: params.get('utm_term') || null,
      content_source: params.get('utm_content') || null,
      // Extra logic for Google Ads specifically
      is_paid: params.has('gclid') || params.has('gbraid') || params.has('wbraid')
    };
  } catch (e) {
    console.error("Invalid URL provided:", rawUrl);
    return { source_url: rawUrl, quote_source: 'Unknown' };
  }
}