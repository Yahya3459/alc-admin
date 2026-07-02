import express, { Request, Response } from "express";
import { storagePut } from "./storage";

export function registerUploadRoutes(app: express.Application) {
  // معالج رفع الملفات - نستخدم express.raw لمعالجة البيانات الثنائية مباشرة
  app.post("/api/upload", express.raw({ type: "*/*", limit: "10mb" }), async (req: Request, res: Response) => {
    try {
      const buffer = req.body;
      
      if (!buffer || buffer.length === 0) {
        console.error("[Upload] Empty body received");
        return res.status(400).json({ error: "لا يوجد ملف في الطلب أو الملف فارغ" });
      }

      // حد أقصى 5 MB
      const MAX_SIZE = 5 * 1024 * 1024;
      if (buffer.length > MAX_SIZE) {
        return res.status(413).json({ error: "حجم الملف يتجاوز 5 MB" });
      }

      // تحديد نوع المحتوى من رؤوس الطلب
      const contentType = req.headers["content-type"] || "application/octet-stream";
      
      // تحديد اسم الملف
      const rawFilename = req.headers["x-filename"] as string;
      const filename = rawFilename ? decodeURIComponent(rawFilename) : `id-card-${Date.now()}`;
      
      console.log(`[Upload] Receiving file: ${filename}, size: ${buffer.length}, type: ${contentType}`);

      // رفع الملف باستخدام نظام التخزين المدمج
      const result = await storagePut(`certificates/${filename}`, buffer, contentType as string);
      
      console.log(`[Upload] Success: ${result.url}`);
      
      return res.json({ 
        success: true, 
        url: result.url,
        key: result.key 
      });
    } catch (error: any) {
      console.error("[Upload] Error:", error);
      return res.status(500).json({ error: "فشل رفع الملف: " + (error.message || "خطأ داخلي") });
    }
  });
}
