const fs = require('fs');
const path = require('path');

const dir = 'd:/Parking-Building-Management-System/fe/src/services';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'apiClient.ts' && f !== 'authService.ts');

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove BASE_URL definition
    content = content.replace(/const BASE_URL = import.meta.env.VITE_API_URL \?\? 'http:\/\/localhost:5237';\r?\n/, '');

    // Remove apiFetch / authFetch block
    content = content.replace(/async function (apiFetch|authFetch)[\s\S]*?return data as T;\r?\n}\r?\n/, '');
    
    // Add import { apiClient } from './apiClient';
    if (!content.includes("import { apiClient }")) {
        content = `import { apiClient } from './apiClient';\n\n` + content;
    }

    // Replace apiFetch( and authFetch( with apiClient(
    content = content.replace(/apiFetch\(/g, 'apiClient(');
    content = content.replace(/authFetch\(/g, 'apiClient(');

    // Now remove `token: string` or `, token?: string` or `, token: string` from function parameters.
    // E.g. (payload: CreateBuildingRequest, token: string): Promise<BuildingResponse> =>
    // E.g. (id: string, mode: number, token: string): Promise<BuildingResponse> =>
    content = content.replace(/, token\??: string/g, '');
    content = content.replace(/\(token: string\)/g, '()');
    content = content.replace(/\(token\??: string/g, '(');

    // Now fix the apiClient calls. They might have `, token` or `undefined, token` at the end.
    // apiClient('/api/path', undefined, token) => apiClient('/api/path')
    // apiClient('/api/path', { method: 'POST' }, token) => apiClient('/api/path', { method: 'POST' })
    content = content.replace(/, undefined, token\)/g, ')');
    content = content.replace(/, \{([^\}]*)\}, token\)/g, ', {$1})');
    // For single token argument (if it existed?): apiClient('/api/path', token) - Wait checkInService uses: authFetch('/api/checkin/walk-in', token, { method: 'POST' })
    // In checkInService: authFetch(path, token, options)
    // So we need to handle authFetch signatures!
    content = content.replace(/apiClient\(([^,]+), token, ([^\)]+)\)/g, 'apiClient($1, $2)');
    // Some might just pass token? apiClient(path, token)
    content = content.replace(/apiClient\(([^,]+), token\)/g, 'apiClient($1)');
    
    // Any remaining `, token)` ?
    content = content.replace(/, token\)/g, ')');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Refactored ${file}`);
}
