import { a as getDb, ad as resolveInboxImportInstant, ae as getAmsterdamWallHour, af as inferEitjeHoursExportKindFromFileName, ag as canonicalInboxSalesRow } from '../nitro/nitro.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';

const FIELD_MAPPINGS = {
  hours: [
    // Eitje Hours CSV columns (Dutch)
    { sourceColumn: "datum", targetField: "date", required: true, transform: (v) => parseDate(v) },
    // Legacy + daily-email export: some files use "naam", others only "Naam van medewerker" (later row wins)
    { sourceColumn: "naam", targetField: "employee_name" },
    { sourceColumn: "Naam van medewerker", targetField: "employee_name" },
    // Vestiging optional in newer exports; team used as fallback below when missing
    { sourceColumn: "naam van vestiging", targetField: "location_name" },
    { sourceColumn: "vestiging", targetField: "location_name" },
    { sourceColumn: "team naam", targetField: "team_name" },
    { sourceColumn: "Team", targetField: "team_name" },
    { sourceColumn: "type", targetField: "shift_type" },
    { sourceColumn: "uren", targetField: "hours", transform: (v) => parseTimeToHours(v) },
    { sourceColumn: "gerealizeerde loonkosten", targetField: "realized_labor_costs", transform: (v) => parseEuro(v) },
    { sourceColumn: "Loonkosten", targetField: "realized_labor_costs", transform: (v) => parseEuro(v) },
    { sourceColumn: "Loonkosten per uur", targetField: "cost_per_hour", transform: (v) => parseEuro(v) },
    { sourceColumn: "contracttype", targetField: "contract_type" },
    { sourceColumn: "uurloon", targetField: "hourly_rate", transform: (v) => parseEuro(v) },
    { sourceColumn: "support ID", targetField: "support_id", transform: (v) => String(v) },
    // English fallbacks (only one date column required: datum or Date or Datum)
    { sourceColumn: "Date", targetField: "date", transform: (v) => parseDate(v) },
    { sourceColumn: "Datum", targetField: "date", transform: (v) => parseDate(v) },
    { sourceColumn: "Employee", targetField: "employee_name" },
    { sourceColumn: "Hours", targetField: "hours", transform: (v) => parseTimeToHours(v) },
    { sourceColumn: "Location", targetField: "location_name" }
  ],
  contracts: [
    // Eitje Contracts CSV columns (Dutch)
    { sourceColumn: "naam", targetField: "employee_name", required: true },
    { sourceColumn: "contracttype", targetField: "contract_type", required: true },
    { sourceColumn: "uurloon", targetField: "hourly_rate", transform: (v) => parseEuro(v) },
    { sourceColumn: "wekelijkse contracturen", targetField: "weekly_contract_hours", transform: (v) => parseTimeToHours(v) },
    { sourceColumn: "contractvestiging", targetField: "contract_location" },
    { sourceColumn: "Loonkosten per uur", targetField: "cost_per_hour", transform: (v) => parseEuro(v) },
    { sourceColumn: "eind plus/min saldo", targetField: "end_balance", transform: (v) => parseTimeToHours(v) },
    { sourceColumn: "eind verlofsaldo", targetField: "end_leave_balance", transform: (v) => parseTimeToHours(v) },
    { sourceColumn: "* totaal gewerkte dagen", targetField: "total_worked_days", transform: (v) => Number(v) || 0 },
    { sourceColumn: "* totaal gewerkte uren", targetField: "total_worked_hours", transform: (v) => parseTimeToHours(v) },
    { sourceColumn: "* ziekteuren", targetField: "sick_hours", transform: (v) => parseTimeToHours(v) },
    { sourceColumn: "* bijzonder verlofuren", targetField: "special_leave_hours", transform: (v) => parseTimeToHours(v) },
    { sourceColumn: "maandelijkse contracturen", targetField: "monthly_contract_hours", transform: (v) => parseTimeToHours(v) },
    { sourceColumn: "contracturen in periode", targetField: "contract_hours_in_period", transform: (v) => parseTimeToHours(v) },
    { sourceColumn: "vloer ID", targetField: "floor_id", transform: (v) => String(v) },
    { sourceColumn: "Nmbrs ID", targetField: "nmbrs_id", transform: (v) => String(v) },
    { sourceColumn: "e-mailadres", targetField: "email" },
    { sourceColumn: "verjaardag", targetField: "birthday", transform: (v) => typeof v === "string" && v.trim() ? v.trim() : null },
    { sourceColumn: "achternaam", targetField: "last_name" },
    { sourceColumn: "voornaam", targetField: "first_name" },
    { sourceColumn: "support ID", targetField: "support_id", transform: (v) => String(v) },
    {
      sourceColumn: "startdatum",
      targetField: "start_date",
      transform: (v) => parseDate(v)
    },
    {
      sourceColumn: "einddatum",
      targetField: "end_date",
      transform: (v) => parseDate(v)
    },
    {
      sourceColumn: "start_date",
      targetField: "start_date",
      transform: (v) => parseDate(v)
    },
    {
      sourceColumn: "end_date",
      targetField: "end_date",
      transform: (v) => parseDate(v)
    },
    // English fallbacks
    { sourceColumn: "Name", targetField: "employee_name" },
    { sourceColumn: "ContractType", targetField: "contract_type" },
    { sourceColumn: "StartDate", targetField: "start_date", transform: (v) => parseDate(v) },
    { sourceColumn: "EndDate", targetField: "end_date", transform: (v) => parseDate(v) }
  ],
  finance: [
    { sourceColumn: "datum", targetField: "date", required: true, transform: (v) => parseDate(v) },
    { sourceColumn: "Date", targetField: "date", transform: (v) => parseDate(v) },
    { sourceColumn: "naam van vestiging", targetField: "location_name" },
    { sourceColumn: "omzetgroep naam", targetField: "revenue_group_name" },
    { sourceColumn: "gerealiseerde arbeidsproductiviteit", targetField: "labor_productivity", transform: (v) => Number(v) || 0 },
    { sourceColumn: "gerealiseerde loonkosten", targetField: "realized_labor_costs", transform: (v) => parseEuro(v) },
    { sourceColumn: "gerealiseerde loonkosten percentage", targetField: "labor_costs_percentage", transform: (v) => Number(v) || 0 },
    { sourceColumn: "gewerkte uren", targetField: "hours", transform: (v) => parseTimeToHours(v) },
    { sourceColumn: "gerealiseerde omzet", targetField: "realized_revenue", transform: (v) => parseEuro(v) },
    { sourceColumn: "support ID", targetField: "support_id", transform: (v) => String(v) },
    { sourceColumn: "Amount", targetField: "amount", transform: (v) => Number(v) || 0 },
    { sourceColumn: "Description", targetField: "description" },
    { sourceColumn: "Category", targetField: "category" }
  ],
  sales: [
    // Bork Sales CSV columns (Trivec format + normalized shape)
    { sourceColumn: "date", targetField: "date", required: false },
    { sourceColumn: "Date", targetField: "date", required: false, transform: (v) => parseDate(v) },
    { sourceColumn: "Datum", targetField: "date", required: false, transform: (v) => parseDate(v) },
    { sourceColumn: "location_name", targetField: "location_name" },
    { sourceColumn: "location", targetField: "location_name" },
    { sourceColumn: "product_name", targetField: "product_name" },
    { sourceColumn: "Product", targetField: "product_name" },
    { sourceColumn: "Productnaam", targetField: "product_name" },
    { sourceColumn: "quantity", targetField: "quantity", transform: (v) => Number(v) || 0 },
    { sourceColumn: "Quantity", targetField: "quantity", transform: (v) => Number(v) || 0 },
    { sourceColumn: "Aantal", targetField: "quantity", transform: (v) => Number(v) || 0 },
    { sourceColumn: "revenue", targetField: "revenue", transform: (v) => typeof v === "number" ? v : parseEuro(v) },
    { sourceColumn: "Revenue", targetField: "revenue", transform: (v) => parseEuro(v) || Number(v) || 0 },
    { sourceColumn: "Omzet", targetField: "revenue", transform: (v) => parseEuro(v) || Number(v) || 0 },
    { sourceColumn: "Salesperson", targetField: "salesperson_name" },
    { sourceColumn: "Verkoper", targetField: "salesperson_name" },
    { sourceColumn: "Category", targetField: "category" },
    { sourceColumn: "Categorie", targetField: "category" }
  ],
  payroll: [],
  bi: [],
  other: [],
  formitabele: [],
  pasy: [],
  coming_soon: [],
  product_mix: [],
  food_beverage: [],
  basis_report: [],
  product_sales_per_hour: []
};
const COLLECTION_NAMES = {
  hours: "inbox-eitje-hours",
  contracts: "inbox-eitje-contracts",
  finance: "inbox-eitje-finance",
  sales: "bork_sales",
  payroll: "payroll",
  bi: "power_bi_exports",
  other: "other_documents",
  formitabele: "formitabele",
  pasy: "pasy",
  coming_soon: "coming_soon",
  product_mix: "inbox-bork-product-mix",
  food_beverage: "inbox-bork-food-beverage",
  basis_report: "inbox-bork-basis-report",
  product_sales_per_hour: "inbox-bork-basis-report"
};
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === "") return null;
  const ddmmyyyy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  }
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }
  return null;
}
function parseTimeToHours(value) {
  if (value == null) return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  const timeStr = String(value).trim();
  if (timeStr === "") return 0;
  const timeMatch = timeStr.match(/^(\d+):(\d{2})$/);
  if (timeMatch) {
    const [, hours, minutes] = timeMatch;
    return parseInt(hours, 10) + parseInt(minutes, 10) / 60;
  }
  if (/,/.test(timeStr)) {
    const normalized = timeStr.replace(/\./g, "").replace(",", ".");
    const num2 = Number(normalized);
    return isNaN(num2) ? 0 : num2;
  }
  const num = Number(timeStr);
  return isNaN(num) ? 0 : num;
}
function parseEuro(euroStr) {
  if (euroStr == null) return 0;
  if (typeof euroStr === "number") return isNaN(euroStr) ? 0 : euroStr;
  const str = String(euroStr);
  if (!str || str.trim() === "") return 0;
  let cleaned = str.replace(/[\u20AC\uFFFD\u0080]/g, "").replace(/\s/g, "").trim();
  if (cleaned.toLowerCase().includes("n.v.t") || cleaned === "") return 0;
  cleaned = cleaned.replace(",", ".");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}
function getRowValue(row, sourceColumn) {
  if (Object.prototype.hasOwnProperty.call(row, sourceColumn)) return row[sourceColumn];
  const key = Object.keys(row).find((k) => k.trim().toLowerCase() === sourceColumn.trim().toLowerCase());
  return key !== void 0 ? row[key] : void 0;
}
class DataMappingService {
  /**
   * Map parsed data to MongoDB collection.
   * @param db - Optional DB instance (e.g. mongoose.connection.db) so the collection is created in the same DB as the rest of the app.
   */
  async mapToCollection(parsedData, documentType, db) {
    if (documentType === "formitabele" || documentType === "pasy" || documentType === "coming_soon") {
      return {
        success: false,
        mappedToCollection: COLLECTION_NAMES[documentType],
        matchedRecords: 0,
        createdRecords: 0,
        updatedRecords: 0,
        failedRecords: parsedData.rowsProcessed,
        errors: [
          {
            row: 0,
            error: `Document type "${documentType}" is not yet supported (coming soon)`
          }
        ]
      };
    }
    const collectionName = COLLECTION_NAMES[documentType];
    const fieldMappings = FIELD_MAPPINGS[documentType];
    if (documentType === "other" || fieldMappings.length === 0) {
      try {
        const database = db != null ? db : await getDb();
        const collection = database.collection(collectionName);
        const docs = parsedData.data.rows.map((row) => ({
          _id: new ObjectId(),
          source: "inbox",
          importedAt: /* @__PURE__ */ new Date(),
          raw: row,
          headers: parsedData.data.headers
        }));
        if (docs.length > 0) {
          await collection.insertMany(docs);
        }
        return {
          success: true,
          mappedToCollection: collectionName,
          matchedRecords: 0,
          createdRecords: docs.length,
          updatedRecords: 0,
          failedRecords: parsedData.rowsProcessed - docs.length,
          errors: []
        };
      } catch (error) {
        return {
          success: false,
          mappedToCollection: collectionName,
          matchedRecords: 0,
          createdRecords: 0,
          updatedRecords: 0,
          failedRecords: parsedData.rowsProcessed,
          errors: [{ row: 0, error: error instanceof Error ? error.message : "Unknown error" }]
        };
      }
    }
    try {
      const database = db != null ? db : await getDb();
      const collection = database.collection(collectionName);
      const mappedRows = [];
      const errors = [];
      const importAt = resolveInboxImportInstant(parsedData);
      const cronHour = getAmsterdamWallHour(importAt);
      parsedData.data.rows.forEach((row, index) => {
        try {
          const mappedRow = {
            _id: new ObjectId(),
            source: "inbox",
            importedAt: importAt,
            cron_hour: cronHour
          };
          let hasRequiredFields = true;
          for (const mapping of fieldMappings) {
            const sourceValue = getRowValue(row, mapping.sourceColumn);
            if (mapping.required && (sourceValue === null || sourceValue === void 0 || sourceValue === "")) {
              errors.push({
                row: index + 1,
                error: `Missing required field: ${mapping.sourceColumn}`
              });
              hasRequiredFields = false;
              break;
            }
            if (sourceValue !== null && sourceValue !== void 0 && sourceValue !== "") {
              mappedRow[mapping.targetField] = mapping.transform ? mapping.transform(sourceValue) : sourceValue;
            }
          }
          if (documentType === "hours" && hasRequiredFields) {
            const teamVal = mappedRow.team_name;
            const locVal = mappedRow.location_name;
            const hasTeam = teamVal !== void 0 && teamVal !== null && String(teamVal).trim() !== "";
            const hasLoc = locVal !== void 0 && locVal !== null && String(locVal).trim() !== "";
            if (!hasLoc && hasTeam) mappedRow.location_name = teamVal;
            else if (!hasLoc && !hasTeam) mappedRow.location_name = "(onbekend)";
            if (!mappedRow.date) {
              errors.push({ row: index + 1, error: "Missing required field: date" });
              hasRequiredFields = false;
            } else {
              const en = mappedRow.employee_name;
              const hasEmployee = en !== void 0 && en !== null && String(en).trim() !== "";
              if (!hasEmployee) {
                errors.push({
                  row: index + 1,
                  error: "Missing employee name (naam / Naam van medewerker)"
                });
                hasRequiredFields = false;
              }
            }
          }
          if (hasRequiredFields) {
            if (documentType === "hours") {
              const fn = parsedData.sourceAttachmentFileName;
              if (fn && String(fn).trim()) {
                mappedRow.source_attachment_name = String(fn).trim();
                const kind = inferEitjeHoursExportKindFromFileName(fn);
                if (kind) mappedRow.eitje_hours_export_kind = kind;
              }
            }
            mappedRows.push(mappedRow);
          }
        } catch (error) {
          errors.push({
            row: index + 1,
            error: error instanceof Error ? error.message : "Unknown mapping error"
          });
        }
      });
      let createdRecords = 0;
      let updatedRecords = 0;
      let matchedRecords = 0;
      if (mappedRows.length > 0) {
        const operations = mappedRows.map((row) => {
          const rowId = row._id;
          const { _id: _omitId, ...setFields } = row;
          return {
            updateOne: {
              filter: this.getUniqueFilter(row, documentType),
              update: { $set: setFields, $setOnInsert: { _id: rowId } },
              upsert: true
            }
          };
        });
        const result = await collection.bulkWrite(operations);
        createdRecords = result.upsertedCount || 0;
        updatedRecords = result.modifiedCount || 0;
        matchedRecords = result.matchedCount || 0;
      }
      return {
        success: errors.length < parsedData.rowsProcessed,
        mappedToCollection: collectionName,
        matchedRecords,
        createdRecords,
        updatedRecords,
        failedRecords: errors.length,
        errors
      };
    } catch (error) {
      return {
        success: false,
        mappedToCollection: collectionName,
        matchedRecords: 0,
        createdRecords: 0,
        updatedRecords: 0,
        failedRecords: parsedData.rowsProcessed,
        errors: [
          {
            row: 0,
            error: error instanceof Error ? error.message : "Unknown database error"
          }
        ]
      };
    }
  }
  /**
   * Get unique filter for upsert operations (document-type specific)
   */
  getUniqueFilter(row, documentType) {
    var _a;
    switch (documentType) {
      case "hours": {
        const sidRaw = row.support_id != null ? String(row.support_id).trim() : "";
        const sid = sidRaw !== "" ? sidRaw : null;
        const loc = row.location_name != null && String(row.location_name).trim() !== "" ? String(row.location_name).trim() : row.location_name;
        if (sid) {
          return {
            date: row.date,
            location_name: loc,
            support_id: sid
          };
        }
        return {
          date: row.date,
          employee_name: row.employee_name,
          location_name: loc,
          shift_type: row.shift_type || "gewerkte uren",
          team_name: (_a = row.team_name) != null ? _a : ""
        };
      }
      case "contracts":
        return {
          employee_name: row.employee_name,
          support_id: row.support_id
        };
      case "sales":
        return {
          date: row.date,
          location_name: row.location_name,
          product_name: row.product_name
        };
      case "finance":
        return {
          date: row.date,
          location_name: row.location_name,
          support_id: row.support_id
        };
      default:
        return row._id ? { _id: row._id } : row;
    }
  }
  /**
   * Validate mapped data before storing
   */
  validateMappedData(mappedRow, documentType) {
    const errors = [];
    switch (documentType) {
      case "hours":
        if (!mappedRow.date) errors.push("Missing date");
        if (!mappedRow.employee_name) errors.push("Missing employee_name");
        if (mappedRow.hours && typeof mappedRow.hours !== "number") {
          errors.push("Hours must be a number");
        }
        break;
      case "contracts":
        if (!mappedRow.employee_name) errors.push("Missing employee_name");
        break;
      case "sales":
        if (!mappedRow.date) errors.push("Missing date");
        if (mappedRow.revenue && typeof mappedRow.revenue !== "number") {
          errors.push("Revenue must be a number");
        }
        break;
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
const dataMappingService = new DataMappingService();

function getCollectionName(documentType) {
  switch (documentType) {
    case "sales":
      return "inbox-bork-sales";
    case "product_mix":
      return "inbox-bork-product-mix";
    case "food_beverage":
      return "inbox-bork-food-beverage";
    case "basis_report":
      return "inbox-bork-basis-report";
    case "product_sales_per_hour":
      return "inbox-bork-basis-report";
    default:
      return "unknown";
  }
}
function isTestDataType(documentType) {
  return ["sales", "product_mix", "food_beverage", "product_sales_per_hour"].includes(documentType);
}
async function storeRawData(parsedData, documentType, options) {
  if (!isTestDataType(documentType)) {
    return {
      success: false,
      collectionName: "unknown",
      recordsCreated: 0,
      recordsFailed: parsedData.rowsProcessed,
      errors: [
        {
          row: 0,
          error: `Document type "${documentType}" is not a test data type`
        }
      ]
    };
  }
  const collectionName = getCollectionName(documentType);
  const errors = [];
  let recordsCreated = 0;
  try {
    const db = await getDb();
    const collection = db.collection(collectionName);
    const emailId = new ObjectId(parsedData.emailId);
    const attachmentId = new ObjectId(parsedData.attachmentId);
    const documentsToInsert = parsedData.data.rows.map((row, index) => {
      try {
        const baseRow = documentType === "sales" ? canonicalInboxSalesRow(row) : row;
        return {
          ...baseRow,
          sourceEmailId: emailId,
          sourceAttachmentId: attachmentId,
          sourceFileName: (options == null ? void 0 : options.fileName) || "",
          fileFormat: parsedData.format,
          parsedAt: /* @__PURE__ */ new Date()
        };
      } catch (error) {
        errors.push({
          row: index + 1,
          error: error instanceof Error ? error.message : "Unknown error creating document"
        });
        return null;
      }
    }).filter((doc) => doc !== null);
    if (documentsToInsert.length > 0) {
      const result = await collection.insertMany(documentsToInsert, { ordered: false });
      recordsCreated = result.insertedCount;
    }
    return {
      success: errors.length < parsedData.rowsProcessed,
      collectionName,
      recordsCreated,
      recordsFailed: errors.length,
      errors
    };
  } catch (error) {
    return {
      success: false,
      collectionName,
      recordsCreated,
      recordsFailed: parsedData.rowsProcessed,
      errors: [
        {
          row: 0,
          error: error instanceof Error ? error.message : "Unknown database error"
        }
      ]
    };
  }
}

export { dataMappingService as d, isTestDataType as i, storeRawData as s };
//# sourceMappingURL=rawDataStorageService.mjs.map
