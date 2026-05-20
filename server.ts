import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Google Sheets API Proxy
  // We handle all methods to support GET for reading and POST for writing
  app.all("/api/sheets/:action", async (req, res) => {
    const { action } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: authHeader.replace("Bearer ", "") });
    
    // Configure Sheets and Drive with a reasonable timeout
    const sheets = google.sheets({ 
      version: "v4", 
      auth,
    });
    const drive = google.drive({ 
      version: "v3", 
      auth,
    });

    try {
      if (action === "create") {
        const { title, folderId, sheets: customSheets } = req.body;
        console.log(`[Sheets] Creating spreadsheet: ${title}`);
        const spreadsheet = await sheets.spreadsheets.create({
          requestBody: {
            properties: { title },
            sheets: customSheets || [
              { properties: { title: "1. Konteks" } },
              { properties: { title: "2. Identifikasi" } },
              { properties: { title: "3. Analisis" } },
              { properties: { title: "4. Evaluasi" } },
              { properties: { title: "5. RTP" } },
              { properties: { title: "6. Komunikasi" } },
              { properties: { title: "7. Pemantauan" } },
              { properties: { title: "8. Log" } },
            ],
          },
        }, { timeout: 15000 }); // 15 second timeout

        const spreadsheetId = spreadsheet.data.spreadsheetId;
        console.log(`[Sheets] Created: ${spreadsheetId}`);

        // Move to folder if specified
        if (folderId && spreadsheetId) {
          try {
            console.log(`[Sheets] Moving ${spreadsheetId} to folder ${folderId}`);
            const file = await drive.files.get({
              fileId: spreadsheetId,
              fields: 'parents'
            }, { timeout: 10000 });
            const previousParents = file.data.parents?.join(',') || '';
            
            await drive.files.update({
              fileId: spreadsheetId,
              addParents: folderId,
              removeParents: previousParents,
              fields: 'id, parents'
            }, { timeout: 10000 });
          } catch (driveError) {
            console.error("[Sheets] Drive Move Error:", driveError);
          }
        }
        
        return res.json(spreadsheet.data);
      }

      if (action === "read") {
        const spreadsheetId = (req.body.spreadsheetId || req.query.spreadsheetId) as string;
        const range = (req.body.range || req.query.range) as string;
        
        console.log(`[Sheets] Reading: ${spreadsheetId}, range: ${range}`);
        
        if (!spreadsheetId || !range) {
          return res.status(400).json({ error: "spreadsheetId and range are required" });
        }

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        }, { timeout: 15000 });
        return res.json(response.data);
      }

      if (action === "write") {
        const { spreadsheetId, range, values } = req.body;
        console.log(`[Sheets] Writing to ${spreadsheetId}, range: ${range}, rows: ${values?.length || 0}`);
        
        if (!spreadsheetId) {
          return res.status(400).json({ error: "spreadsheetId is required" });
        }

        try {
          const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: "RAW",
            requestBody: { values },
          }, { timeout: 15000 });
          return res.json(response.data);
        } catch (error: any) {
          const statusCode = error.code || error.status;
          
          // If the spreadsheet itself is missing (404), do NOT attempt auto-create sheet
          if (statusCode === 404) {
            throw error; 
          }

          // If error is "Range not found" but spreadsheet exists, indicating a specific sheet tab doesn't exist
          if (error.message && (error.message.includes("range") || error.message.toLowerCase().includes("not found"))) {
            const sheetName = range.split('!')[0];
            console.log(`[Sheets] Sheet tab "${sheetName}" not found in ${spreadsheetId}, attempting to create...`);
            try {
              await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                  requests: [{ addSheet: { properties: { title: sheetName } } }]
                }
              }, { timeout: 10000 });
            } catch (createError: any) {
              // Ignore "already exists" errors during parallel writes
              if (!createError.message?.toLowerCase().includes("already exists")) {
                console.error("[Sheets] Auto-create sheet tab failed:", createError.message);
              }
            }

            // Retry the write once
            try {
              console.log(`[Sheets] Retrying write to ${spreadsheetId} after adding tab`);
              const retryResponse = await sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: "RAW",
                requestBody: { values },
              }, { timeout: 15000 });
              return res.json(retryResponse.data);
            } catch (retryError) {
              console.error("[Sheets] Retry write failed:", retryError);
              throw error;
            }
          }
          throw error;
        }
      }

      if (action === "append") {
        const { spreadsheetId, range, values } = req.body;
        console.log(`[Sheets] Appending to ${spreadsheetId}, rows: ${values?.length || 0}`);
        const response = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          requestBody: { values },
        }, { timeout: 15000 });
        return res.json(response.data);
      }

      if (action === "batchUpdate") {
        const { spreadsheetId, requests } = req.body;
        try {
          const response = await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests },
          }, { timeout: 15000 });
          return res.json(response.data);
        } catch (error: any) {
          if (error.message?.includes("already exists")) {
             return res.json({ status: "already_exists", message: "Sheet already exists, ignore." });
          }
          throw error;
        }
      }

      res.status(400).json({ error: "Unknown action" });
    } catch (error: any) {
      console.error("[Sheets API Error]:", error);
      
      const statusCode = error.code || 500;
      const message = error.message || "Unknown error";
      
      // Special handling for 404
      if (statusCode === 404 || message.includes("Requested entity was not found")) {
        return res.status(404).json({ 
          error: "Not Found",
          message: "Data tidak ditemukan. Pastikan ID benar dan anda memiliki akses."
        });
      }
      
      return res.status(statusCode >= 100 && statusCode < 600 ? statusCode : 500).json({ 
        error: "Sheets API Error",
        message: message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
