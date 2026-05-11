import { O as parsePDF, P as classifyByFilename, Q as parseExcel, R as looksLikeTrivecSemicolonSales, S as parseCSV, T as normalizeTrivecSemicolonSalesParse, U as classifyDocument } from '../nitro/nitro.mjs';

class DocumentParserService {
  detectFormat(fileName, mimeType) {
    const lowerName = fileName.toLowerCase();
    const lowerMime = mimeType.toLowerCase();
    if (lowerMime.includes("csv") || lowerName.endsWith(".csv")) {
      return "csv";
    }
    if (lowerMime.includes("spreadsheet") || lowerMime.includes("excel") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      return "xlsx";
    }
    if (lowerMime.includes("pdf") || lowerName.endsWith(".pdf")) {
      return "pdf";
    }
    if (lowerName.endsWith(".html") || lowerName.endsWith(".htm") || lowerMime.includes("text/html")) {
      return "html";
    }
    return "unknown";
  }
  async parseDocument(options) {
    const format = this.detectFormat(options.fileName, options.mimeType);
    let parseResult;
    try {
      switch (format) {
        case "csv": {
          if (typeof options.data !== "string") {
            return {
              success: false,
              format: "csv",
              headers: [],
              rows: [],
              rowCount: 0,
              error: "CSV data must be a string"
            };
          }
          const filenameHint = classifyByFilename(options.fileName);
          const skipLines = filenameHint.type === "product_mix" ? 10 : filenameHint.type === "food_beverage" ? 8 : void 0;
          const trivecSales = filenameHint.type === "sales" && looksLikeTrivecSemicolonSales(options.data, filenameHint.type);
          if (trivecSales) {
            parseResult = await parseCSV(options.data, {
              autoDetectDelimiter: true,
              header: false,
              coerceNumbers: false
            });
            if (parseResult.success) {
              parseResult = normalizeTrivecSemicolonSalesParse(parseResult, options.data);
            }
          } else {
            parseResult = await parseCSV(options.data, { autoDetectDelimiter: true, skipLines });
          }
          break;
        }
        case "xlsx": {
          if (!(options.data instanceof Buffer)) {
            return {
              success: false,
              format: "xlsx",
              headers: [],
              rows: [],
              rowCount: 0,
              error: "Excel data must be a Buffer"
            };
          }
          const filenameHint = classifyByFilename(options.fileName);
          const basisReportOptions = filenameHint.type === "basis_report" ? {
            parseAllSheets: false,
            skipRows: 9,
            emptyHeadersAsColumnN: true,
            /** Rows 1–5: title, date, blank, venue, address — preserved before skipRows strips them from `rows`. */
            capturePreambleRowCount: 12
          } : { parseAllSheets: true };
          parseResult = await parseExcel(options.data, basisReportOptions);
          break;
        }
        case "pdf": {
          if (!(options.data instanceof Buffer)) {
            return {
              success: false,
              format: "pdf",
              headers: [],
              rows: [],
              rowCount: 0,
              error: "PDF data must be a Buffer"
            };
          }
          parseResult = await parsePDF(options.data, { extractTables: true });
          break;
        }
        case "html": {
          return {
            success: false,
            format: "html",
            headers: [],
            rows: [],
            rowCount: 0,
            error: "HTML files are ignored (not parsed)"
          };
        }
        default: {
          return {
            success: false,
            format: "unknown",
            headers: [],
            rows: [],
            rowCount: 0,
            error: `Unsupported file format: ${format}`
          };
        }
      }
      if (options.autoDetectType !== false && parseResult.success) {
        const classification = classifyDocument(options.fileName, parseResult.headers);
        if (classification.type === "formitabele" || classification.type === "pasy") {
          return {
            ...parseResult,
            success: false,
            error: `Document type "${classification.type}" is not yet supported (coming soon)`,
            documentType: classification.type
          };
        }
        return {
          ...parseResult,
          documentType: classification.type
        };
      }
      return parseResult;
    } catch (error) {
      return {
        success: false,
        format,
        headers: [],
        rows: [],
        rowCount: 0,
        error: error instanceof Error ? error.message : "Unknown parsing error"
      };
    }
  }
}
const documentParserService = new DocumentParserService();

export { documentParserService as d };
//# sourceMappingURL=documentParserService.mjs.map
