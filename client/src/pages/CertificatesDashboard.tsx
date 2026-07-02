import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  Download,
  Zap,
  FileText,
  Filter,
  X,
  ChevronDown,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
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
  const [total, setTotal] = useState(cert.total || "");
  const [finalGrade, setFinalGrade] = useState(cert.finalGrade || "");

  const handleGradeChange = (subject: string, field: string, value: string) => {
    const newGrades = { ...grades, [subject]: { ...grades[subject], [field]: value } };
    
    const score = parseFloat(value);
    if (!isNaN(score)) {
      newGrades[subject].grade = calculateGrade(score);
    }
    
    setGrades(newGrades);
    calculateTotals(newGrades);
  };

  const calculateTotals = (currentGrades: any) => {
    const subjects = config.subjects;
    let totalScore = 0;
    let count = 0;

    subjects.forEach(sub => {
      const val = currentGrades[sub]?.result || (typeof currentGrades[sub] === 'string' ? currentGrades[sub] : "");
      const score = parseFloat(val);
      if (!isNaN(score)) {
        totalScore += score;
        count++;
      }
    });

    if (count > 0) {
      const avg = totalScore / count;
      setTotal(totalScore.toString());
      setAverage(avg.toFixed(2) + "%");
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
            <div className="grid grid-cols-12 gap-2 items-center font-bold border-b pb-2">
              <div className="col-span-4">المادة</div>
              <div className="col-span-4">الدرجة</div>
              <div className="col-span-4">التقدير</div>
            </div>
            {config.subjects.map(sub => (
              <div key={sub} className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                <div className="col-span-4 font-medium">{sub}</div>
                <div className="col-span-4">
                  <Input 
                    placeholder="الدرجة" 
                    type="number"
                    value={grades[sub]?.result || (typeof grades[sub] === 'string' ? grades[sub] : "")}
                    onChange={(e) => handleGradeChange(sub, "result", e.target.value)}
                  />
                </div>
                <div className="col-span-4">
                  <Input placeholder="التقدير" value={grades[sub]?.grade || ""} readOnly className="bg-gray-50" />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <label className="text-sm font-bold">المجموع</label>
              <Input value={total} readOnly className="bg-blue-50 font-semibold" />
            </div>
            <div>
              <label className="text-sm font-bold">المعدل</label>
              <Input value={average} readOnly className="bg-blue-50 font-semibold" />
            </div>
            <div>
              <label className="text-sm font-bold">التقدير العام</label>
              <Input value={finalGrade} readOnly className="bg-blue-50 font-semibold" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button onClick={() => onSave({ grades, average, finalGrade, total })}>حفظ وإكمال</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Export Functions ────────────────────────────────────────────────────────
const exportFunctions = {
  exportToExcel: (cert: any, courseConfigs: typeof COURSE_CONFIGS) => {
    const config = courseConfigs[cert.courseName];
    const data: any = {
      "الاسم بالعربي": cert.fullNameAr,
      "الاسم بالإنجليزي": cert.fullNameEn,
      "الدورة": cert.courseName,
      "الجنس": cert.gender === "male" ? "ذكر" : "أنثى",
      "المجموع": cert.total || "",
      "المعدل": cert.average || "",
      "التقدير العام": cert.finalGrade || "",
    };

    if (config) {
      config.subjects.forEach(sub => {
        const val = cert.grades?.[sub];
        const result = typeof val === 'object' ? (val.result || "") : (val || "");
        const grade = typeof val === 'object' ? (val.grade || "") : "";
        data[sub] = `${result}${grade ? ` (${grade})` : ""}`;
      });
    }

    const worksheet = XLSX.utils.json_to_sheet([data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Certificate");
    XLSX.writeFile(workbook, `${cert.fullNameEn}_${cert.courseName}.xlsx`);
  },

  exportMultipleToExcel: (certs: any[], courseConfigs: typeof COURSE_CONFIGS) => {
    const allSubjects = new Set<string>();
    certs.forEach(cert => {
      const config = courseConfigs[cert.courseName];
      if (config) { config.subjects.forEach(sub => allSubjects.add(sub)); }
    });
    const subjectsArray = Array.from(allSubjects);

    const exportData = certs.map(cert => {
      const config = courseConfigs[cert.courseName];
      const row: any = {
        "الاسم بالعربي": cert.fullNameAr,
        "الاسم بالإنجليزي": cert.fullNameEn,
        "الدورة": cert.courseName,
        "الجنس": cert.gender === "male" ? "ذكر" : "أنثى",
        "المجموع": cert.total || "",
        "المعدل": cert.average || "",
        "التقدير العام": cert.finalGrade || "",
      };

      subjectsArray.forEach(sub => {
        if (config?.subjects.includes(sub)) {
          const val = cert.grades?.[sub];
          const result = typeof val === 'object' ? (val.result || "") : (val || "");
          const grade = typeof val === 'object' ? (val.grade || "") : "";
          row[sub] = `${result}${grade ? ` (${grade})` : ""}`;
        } else {
          row[sub] = "";
        }
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Certificates");
    XLSX.writeFile(workbook, `Certificates_${new Date().toISOString().split('T')[0]}.xlsx`);
  },

  exportToTxt: (cert: any, courseConfigs: typeof COURSE_CONFIGS) => {
    const config = courseConfigs[cert.courseName];
    const lines: string[] = [];
    lines.push(`Name,Course,Total,Average,Grade,${config?.subjects.join(",") || ""}`);
    const gradeValues: string[] = [];
    if (config) {
      config.subjects.forEach(sub => {
        const val = cert.grades?.[sub];
        const result = typeof val === 'object' ? (val.result || "") : (val || "");
        const grade = typeof val === 'object' ? (val.grade || "") : "";
        gradeValues.push(`${result}${grade ? ` (${grade})` : ""}`);
      });
    }
    lines.push(`${cert.fullNameEn},${cert.courseName},${cert.total || ""},${cert.average},${cert.finalGrade},${gradeValues.join(",")}`);
    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `${cert.fullNameEn}_${cert.courseName}.txt`);
  }
};

export default function CertificatesDashboard() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [gradesCert, setGradesCert] = useState<any>(null);

  const utils = trpc.useUtils();
  const { data: certs, isLoading, refetch } = trpc.admin.getCertificateRequests.useQuery();
  const { data: adminUser } = trpc.admin.me.useQuery();
  
  const updateStatus = trpc.admin.updateCertificateStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الحالة بنجاح");
      utils.admin.getCertificateRequests.invalidate();
    }
  });

  const updateGrades = trpc.admin.updateCertificateGrades.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ الدرجات بنجاح");
      setGradesCert(null);
      utils.admin.getCertificateRequests.invalidate();
    }
  });

  const deleteCert = trpc.admin.deleteCertificateRequest.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الطلب بنجاح");
      setDeleteId(null);
      utils.admin.getCertificateRequests.invalidate();
    }
  });

  const filteredCerts = (certs || []).filter(cert => {
    const matchesSearch = 
      cert.fullNameAr.includes(search) || 
      cert.fullNameEn.toLowerCase().includes(search.toLowerCase()) ||
      cert.phone.includes(search);
    
    const matchesStatus = statusFilter === "all" || cert.status === statusFilter;
    const matchesCourse = courseFilter === "all" || cert.courseName === courseFilter;
    const matchesGender = genderFilter === "all" || cert.gender === genderFilter;
    
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const createdAt = new Date(cert.createdAt);
      if (dateFrom && createdAt < new Date(dateFrom)) matchesDate = false;
      if (dateTo && createdAt > new Date(dateTo)) matchesDate = false;
    }

    return matchesSearch && matchesStatus && matchesCourse && matchesGender && matchesDate;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                تصدير البيانات
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => exportFunctions.exportMultipleToExcel(filteredCerts, COURSE_CONFIGS)}>
                تصدير الكل كـ Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const lines = filteredCerts.map(cert => {
                  const config = COURSE_CONFIGS[cert.courseName];
                  const gradeValues = config?.subjects.map(sub => {
                    const val = cert.grades?.[sub];
                    return typeof val === 'object' ? (val.result || "") : (val || "");
                  }).join(",") || "";
                  return `${cert.fullNameEn},${cert.courseName},${cert.total || ""},${cert.average},${cert.finalGrade},${gradeValues}`;
                });
                const content = ["Name,Course,Total,Average,Grade,Subjects...", ...lines].join("\n");
                const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
                saveAs(blob, `Certificates_Summary.txt`);
              }}>
                تصدير الكل كـ Text
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            تحديث
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1">
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="بحث بالاسم أو رقم الهاتف..." 
                className="pr-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="processing">قيد المعالجة</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="rejected">مرفوض</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={showAdvancedFilters ? "text-primary bg-primary/10" : ""}
              >
                {showAdvancedFilters ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
                <span className="mr-2">تصفية متقدمة</span>
              </Button>
            </div>
          </div>

          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 p-4 bg-gray-50 rounded-lg border border-dashed">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">الدورة التدريبية</label>
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الدورات</SelectItem>
                    {Object.keys(COURSE_CONFIGS).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">الجنس</label>
                <Select value={genderFilter} onValueChange={setGenderFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="male">ذكر</SelectItem>
                    <SelectItem value="female">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">من تاريخ</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">إلى تاريخ</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الدورة</TableHead>
                  <TableHead className="text-right">الجنس</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">النتيجة (المجموع / المعدل)</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCerts.length > 0 ? (
                  filteredCerts.map((cert) => (
                    <TableRow key={cert.id}>
                      <TableCell className="font-semibold">{cert.fullNameAr}</TableCell>
                      <TableCell>{cert.courseName}</TableCell>
                      <TableCell>{cert.gender === "male" ? "ذكر" : "أنثى"}</TableCell>
                      <TableCell>
                        {adminUser?.role === "teacher" ? (
                          <CertStatusBadge status={cert.status as CertStatusKey} />
                        ) : (
                          <Select
                            value={cert.status}
                            onValueChange={(v) => updateStatus.mutate({ id: cert.id, status: v as CertStatusKey })}
                          >
                            <SelectTrigger className="h-8 w-36 border-0 p-0 focus:ring-0 bg-transparent">
                              <CertStatusBadge status={cert.status as CertStatusKey} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">قيد الانتظار</SelectItem>
                              <SelectItem value="processing">قيد المعالجة</SelectItem>
                              <SelectItem value="completed">مكتمل</SelectItem>
                              <SelectItem value="rejected">مرفوض</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {cert.average ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{cert.total || "—"} / {cert.average}</span>
                            <span className="text-xs text-muted-foreground">({cert.finalGrade})</span>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setGradesCert(cert)} title="إدخال الدرجات"><FileText className="w-4 h-4 text-blue-600" /></Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" title="تنزيل الشهادة">
                              <Download className="w-4 h-4 text-green-600" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => exportFunctions.exportToExcel(cert, COURSE_CONFIGS)}>تنزيل كـ Excel</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportFunctions.exportToTxt(cert, COURSE_CONFIGS)}>تنزيل كـ Text</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {adminUser?.role !== "teacher" && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(cert.id)}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">لا توجد شهادات تطابق الفلاتر المحددة</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {gradesCert && (
        <GradesModal cert={gradesCert} onClose={() => setGradesCert(null)} onSave={(data) => updateGrades.mutate({ id: gradesCert.id, ...data })} />
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
