import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  Eye,
  Download,
  Zap,
  FileText,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, Table as DocTable, TableCell as DocTableCell, TableRow as DocTableRow, WidthType, BorderStyle, AlignmentType } from "docx";
import { saveAs } from "file-saver";

// ─── Status config ────────────────────────────────────────────────────────────
const CERT_STATUS_MAP = {
  pending:    { label: "قيد الانتظار",   color: "status-pending",   icon: Clock },
  processing: { label: "قيد المعالجة",   color: "status-processing", icon: Zap },
  completed:  { label: "مكتمل",         color: "status-enrolled",  icon: CheckCircle },
  rejected:   { label: "مرفوض",         color: "status-rejected",  icon: XCircle },
} as const;

type CertStatusKey = keyof typeof CERT_STATUS_MAP;

function CertStatusBadge({ status }: { status: CertStatusKey }) {
  const cfg = CERT_STATUS_MAP[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <cfg.icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── Course Config ────────────────────────────────────────────────────────────
const COURSE_CONFIGS: Record<string, { subjects: string[], isIcdl?: boolean, isGraphics?: boolean }> = {
  "TOEFL": {
    subjects: ["Listening", "Structure and written expression", "Reading", "Writing", "Speaking"]
  },
  "DIPLOMA_ADVANCED": {
    subjects: ["AD_A", "AD_B", "AD_C", "AD_D", "AD_E", "AD_F", "AD_G"]
  },
  "DIPLOMA_INTERMEDIATE": {
    subjects: ["INT_A", "INT_B", "INT_C", "INT_D", "INT_E", "INT_F", "INT_G"]
  },
  "DIPLOMA_ELEMENTARY": {
    subjects: ["ELT_A", "ELT_B", "ELT_C", "ELT_D", "ELT_E", "ELT_F", "ELT_G"]
  },
  "ICDL": {
    isIcdl: true,
    subjects: ["IT concepts", "Windows", "Word", "Excel", "Access", "PowerPoint", "Internet"]
  },
  "GRAPHICS": {
    isGraphics: true,
    subjects: ["Photoshop", "illustrator", "InDesign", "Project"]
  }
};

const ICDL_HOURS: Record<string, number> = {
  "IT concepts": 12, "Windows": 14, "Word": 14, "Excel": 18, "Access": 18, "PowerPoint": 12, "Internet": 12
};

function calculateGrade(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "V.Good";
  if (score >= 70) return "Good";
  if (score >= 50) return "Pass";
  return "Fail";
}

// ─── Grades Entry Modal ──────────────────────────────────────────────────────
function GradesModal({ cert, onClose, onSave }: { cert: any, onClose: () => void, onSave: (data: any) => void }) {
  const config = COURSE_CONFIGS[cert.courseName] || { subjects: [] };
  const [grades, setGrades] = useState<Record<string, any>>(cert.grades || {});
  const [average, setAverage] = useState(cert.average || "");
  const [finalGrade, setFinalGrade] = useState(cert.finalGrade || "");

  const handleGradeChange = (subject: string, field: string, value: string) => {
    const newGrades = { ...grades, [subject]: { ...grades[subject], [field]: value } };
    
    // Auto calculate for ICDL/Graphics
    if (field === "result") {
      const score = parseFloat(value);
      if (!isNaN(score)) {
        newGrades[subject].grade = calculateGrade(score);
      }
    }
    
    setGrades(newGrades);
    calculateTotals(newGrades);
  };

  const calculateTotals = (currentGrades: any) => {
    const subjects = config.subjects;
    let totalScore = 0;
    let count = 0;

    subjects.forEach(sub => {
      const val = currentGrades[sub]?.result || currentGrades[sub];
      const score = parseFloat(val);
      if (!isNaN(score)) {
        totalScore += score;
        count++;
      }
    });

    if (count > 0) {
      const avg = totalScore / count;
      const avgFormatted = avg.toFixed(2);
      setAverage(avgFormatted + (cert.courseName === "ICDL" || cert.courseName === "GRAPHICS" ? "%" : ""));
      setFinalGrade(calculateGrade(avg));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>إدخال درجات: {cert.fullNameAr}</CardTitle>
          <p className="text-sm text-muted-foreground">الدورة: {cert.courseName}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {config.subjects.map(sub => (
              <div key={sub} className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                <div className="col-span-4 font-medium">{sub}</div>
                <div className="col-span-4">
                  <Input 
                    placeholder="الدرجة" 
                    type="number"
                    value={config.isIcdl || config.isGraphics ? (grades[sub]?.result || "") : (grades[sub] || "")}
                    onChange={(e) => config.isIcdl || config.isGraphics ? handleGradeChange(sub, "result", e.target.value) : setGrades({...grades, [sub]: e.target.value})}
                  />
                </div>
                {(config.isIcdl || config.isGraphics) && (
                  <div className="col-span-4">
                    <Input placeholder="التقدير" value={grades[sub]?.grade || ""} readOnly className="bg-gray-50" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <label className="text-sm font-bold">المعدل / المجموع</label>
              <Input value={average} readOnly className="bg-blue-50 font-semibold" />
            </div>
            <div>
              <label className="text-sm font-bold">التقدير العام</label>
              <Input value={finalGrade} readOnly className="bg-blue-50 font-semibold" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button onClick={() => onSave({ grades, average, finalGrade })}>حفظ وإكمال</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Export Functions ────────────────────────────────────────────────────────
const exportFunctions = {
  exportToTxt: (cert: any, courseConfigs: typeof COURSE_CONFIGS) => {
    const config = courseConfigs[cert.courseName];
    const lines: string[] = [];
    
    lines.push(`Name,Course,Average,Grade,${config?.subjects.join(",") || ""}`);
    
    const gradeValues: string[] = [];
    if (config) {
      config.subjects.forEach(sub => {
        const val = cert.grades?.[sub];
        gradeValues.push(typeof val === 'object' ? (val.result || "") : (val || ""));
      });
    }
    
    lines.push(`${cert.fullNameEn},${cert.courseName},${cert.average},${cert.finalGrade},${gradeValues.join(",")}`);
    
    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cert.fullNameEn}_${cert.courseName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportToWord: async (cert: any, courseConfigs: typeof COURSE_CONFIGS) => {
    const config = courseConfigs[cert.courseName];
    
    const tableRows: DocTableRow[] = [];
    
    // Header row
    const headerCells = [
      new DocTableCell({ children: [new Paragraph("Name")] }),
      new DocTableCell({ children: [new Paragraph("Course")] }),
      new DocTableCell({ children: [new Paragraph("Average")] }),
      new DocTableCell({ children: [new Paragraph("Grade")] }),
    ];
    
    if (config) {
      config.subjects.forEach(sub => {
        headerCells.push(new DocTableCell({ children: [new Paragraph(sub)] }));
      });
    }
    
    tableRows.push(new DocTableRow({ children: headerCells }));
    
    // Data row
    const dataCells = [
      new DocTableCell({ children: [new Paragraph(cert.fullNameEn)] }),
      new DocTableCell({ children: [new Paragraph(cert.courseName)] }),
      new DocTableCell({ children: [new Paragraph(cert.average || "")] }),
      new DocTableCell({ children: [new Paragraph(cert.finalGrade || "")] }),
    ];
    
    if (config) {
      config.subjects.forEach(sub => {
        const val = cert.grades?.[sub];
        const displayVal = typeof val === 'object' ? (val.result || "") : (val || "");
        dataCells.push(new DocTableCell({ children: [new Paragraph(displayVal)] }));
      });
    }
    
    tableRows.push(new DocTableRow({ children: dataCells }));
    
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            text: `Certificate Report - ${cert.fullNameEn}`,
            bold: true,
            size: 28,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph(""),
          new DocTable({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            },
          }),
        ],
      }],
    });
    
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${cert.fullNameEn}_${cert.courseName}.docx`);
  },
};

// ─── Main Certificates Dashboard ──────────────────────────────────────────────
export default function CertificatesDashboard() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedCert, setSelectedCert] = useState<any>(null);
  const [gradesCert, setGradesCert] = useState<any>(null);

  const utils = trpc.useUtils();

  const { data: certs, isLoading, refetch } = trpc.admin.getCertificateRequests.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const updateStatus = trpc.admin.updateCertificateStatus.useMutation({
    onSuccess: () => { utils.admin.getCertificateRequests.invalidate(); toast.success("تم تحديث الحالة"); },
  });

  const updateGrades = trpc.admin.updateCertificateGrades.useMutation({
    onSuccess: () => { 
      utils.admin.getCertificateRequests.invalidate(); 
      setGradesCert(null);
      toast.success("تم حفظ الدرجات وتحديث الطلب"); 
    },
  });

  const deleteCert = trpc.admin.deleteCertificateRequest.useMutation({
    onSuccess: () => { utils.admin.getCertificateRequests.invalidate(); setDeleteId(null); toast.success("تم حذف الطلب"); },
  });

  const filteredCerts = certs?.filter((cert) => {
    const matchesSearch = cert.fullNameAr.includes(search) || cert.fullNameEn.includes(search) || cert.phone.includes(search);
    const matchesStatus = statusFilter === "all" || cert.status === statusFilter;
    const matchesCourse = courseFilter === "all" || cert.courseName === courseFilter;
    return matchesSearch && matchesStatus && matchesCourse;
  }) || [];

  const exportToExcel = () => {
    const data = filteredCerts.map(c => ({
      "الاسم عربي": c.fullNameAr,
      "الاسم إنجليزي": c.fullNameEn,
      "الدورة": c.courseName,
      "المعدل": c.average || "",
      "التقدير": c.finalGrade || "",
      "التاريخ": new Date(c.createdAt).toLocaleDateString("ar-SA")
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الشهادات");
    XLSX.writeFile(wb, "Certificate_Requests.xlsx");
  };

  const exportAllToTxt = () => {
    const lines: string[] = [];
    
    // Get all unique subjects from all certificates
    const allSubjects = new Set<string>();
    filteredCerts.forEach(cert => {
      const config = COURSE_CONFIGS[cert.courseName];
      if (config) {
        config.subjects.forEach(sub => allSubjects.add(sub));
      }
    });
    
    const subjectsArray = Array.from(allSubjects);
    lines.push(`Name,Course,Average,Grade,${subjectsArray.join(",")}`);
    
    filteredCerts.forEach(cert => {
      const config = COURSE_CONFIGS[cert.courseName];
      const gradeValues: string[] = [];
      
      subjectsArray.forEach(sub => {
        if (config?.subjects.includes(sub)) {
          const val = cert.grades?.[sub];
          gradeValues.push(typeof val === 'object' ? (val.result || "") : (val || ""));
        } else {
          gradeValues.push("");
        }
      });
      
      lines.push(`${cert.fullNameEn},${cert.courseName},${cert.average || ""},${cert.finalGrade || ""},${gradeValues.join(",")}`);
    });
    
    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `All_Certificates_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-lg">إدارة طلبات الشهادات</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5"><RefreshCw className="w-4 h-4" /> تحديث</Button>
              <Button size="sm" onClick={exportToExcel} className="gap-1.5 bg-green-600 text-white"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
              <Button size="sm" onClick={exportAllToTxt} className="gap-1.5 bg-blue-600 text-white"><FileText className="w-4 h-4" /> Text</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9 h-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
              </SelectContent>
            </Select>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="الدورة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الدورات</SelectItem>
                {Object.keys(COURSE_CONFIGS).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الدورة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">النتيجة</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCerts.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-semibold">{cert.fullNameAr}</TableCell>
                    <TableCell>{cert.courseName}</TableCell>
                    <TableCell><CertStatusBadge status={cert.status as CertStatusKey} /></TableCell>
                    <TableCell>{cert.average ? `${cert.average} (${cert.finalGrade})` : "—"}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setGradesCert(cert)} title="إدخال الدرجات"><FileText className="w-4 h-4 text-blue-600" /></Button>
                      {cert.average && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" title="تنزيل الشهادة">
                              <Download className="w-4 h-4 text-green-600" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => exportFunctions.exportToTxt(cert, COURSE_CONFIGS)}>
                              تنزيل كـ Text
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportFunctions.exportToWord(cert, COURSE_CONFIGS)}>
                              تنزيل كـ Word
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(cert.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {gradesCert && (
        <GradesModal 
          cert={gradesCert} 
          onClose={() => setGradesCert(null)} 
          onSave={(data) => updateGrades.mutate({ id: gradesCert.id, ...data })}
        />
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف الطلب نهائياً.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteCert.mutate({ id: deleteId })} className="bg-red-600">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
