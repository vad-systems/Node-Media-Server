import { URL } from 'url';

const LOCALHOST_REPRESENTATIONS = [
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0'
];

export function obfuscateUrl(urlStr: string | undefined): string | undefined {
  if (!urlStr) return urlStr;
  
  try {
    // Basic check if it's a URL-like string
    if (!urlStr.includes('://')) {
        return urlStr;
    }

    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    
    if (LOCALHOST_REPRESENTATIONS.includes(hostname)) {
      return urlStr;
    }
    
    // Obfuscate external URLs: keep host, obfuscate path
    return `${url.protocol}//${url.host}/***`;
  } catch (e) {
    // If it's not a standard URL, try a manual split to at least hide host and query
    if (urlStr.includes('://')) {
        const [protocol, rest] = urlStr.split('://');
        const [hostPortPath, query] = rest.split('?');
        const [hostPort, ...pathParts] = hostPortPath.split('/');
        
        const hostname = hostPort.split(':')[0].toLowerCase();
        if (LOCALHOST_REPRESENTATIONS.includes(hostname)) {
            return urlStr;
        }
        
        return `${protocol}://${hostPort}/***`;
    }
    
    return urlStr;
  }
}
