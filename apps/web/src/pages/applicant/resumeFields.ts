import type { ResumeSection } from '@nezarat/shared';

export type FieldDef = { name: string; label: string; type: 'text' | 'number' | 'date' | 'select' | 'textarea'; options?: [string, string][]; required?: boolean; ltr?: boolean };

export const DEGREES: [string, string][] = [['bachelor', 'کارشناسی'], ['master', 'کارشناسی ارشد'], ['phd', 'دکتری'], ['postdoc', 'پسادکتری']];
export const PUB_TYPES: [string, string][] = [['journal', 'مقالهٔ مجله'], ['conference', 'مقالهٔ کنفرانس'], ['book', 'کتاب'], ['chapter', 'فصل کتاب']];

export const RESUME_FIELDS: Record<ResumeSection, FieldDef[]> = {
  education: [
    { name: 'degree', label: 'مقطع', type: 'select', options: DEGREES, required: true },
    { name: 'field', label: 'رشته و گرایش', type: 'text', required: true },
    { name: 'university', label: 'دانشگاه', type: 'text', required: true },
    { name: 'country', label: 'کشور', type: 'text' },
    { name: 'startDate', label: 'تاریخ شروع', type: 'date' },
    { name: 'endDate', label: 'تاریخ فراغت', type: 'date' },
    { name: 'gpa', label: 'معدل', type: 'number' },
    { name: 'thesisTitle', label: 'عنوان پایان‌نامه/رساله', type: 'textarea' },
  ],
  publications: [
    { name: 'type', label: 'نوع اثر', type: 'select', options: PUB_TYPES, required: true },
    { name: 'title', label: 'عنوان', type: 'textarea', required: true },
    { name: 'venue', label: 'نشریه / ناشر / همایش', type: 'text' },
    { name: 'year', label: 'سال انتشار', type: 'number' },
    { name: 'authors', label: 'نویسندگان', type: 'text' },
    { name: 'role', label: 'نقش شما', type: 'text' },
    { name: 'indexing', label: 'نمایه (ISI، Scopus، ISC، ...)', type: 'text' },
    { name: 'doi', label: 'DOI', type: 'text', ltr: true },
  ],
  researchProjects: [
    { name: 'title', label: 'عنوان طرح', type: 'textarea', required: true },
    { name: 'employer', label: 'کارفرما', type: 'text' },
    { name: 'role', label: 'نقش (مجری، همکار، ...)', type: 'text' },
    { name: 'budget', label: 'مبلغ (ریال)', type: 'number' },
    { name: 'startDate', label: 'تاریخ شروع', type: 'date' },
    { name: 'endDate', label: 'تاریخ پایان', type: 'date' },
    { name: 'status', label: 'وضعیت', type: 'select', options: [['ongoing', 'در حال اجرا'], ['done', 'خاتمه‌یافته']] },
  ],
  teachingExperience: [
    { name: 'institution', label: 'مؤسسه/دانشگاه', type: 'text', required: true },
    { name: 'course', label: 'نام درس', type: 'text', required: true },
    { name: 'level', label: 'مقطع', type: 'select', options: DEGREES.slice(0, 3) },
    { name: 'hours', label: 'ساعات تدریس', type: 'number' },
    { name: 'startDate', label: 'از تاریخ', type: 'date' },
    { name: 'endDate', label: 'تا تاریخ', type: 'date' },
  ],
  executiveExperience: [
    { name: 'organization', label: 'سازمان', type: 'text', required: true },
    { name: 'position', label: 'سمت', type: 'text', required: true },
    { name: 'startDate', label: 'از تاریخ', type: 'date' },
    { name: 'endDate', label: 'تا تاریخ', type: 'date' },
  ],
  patents: [
    { name: 'title', label: 'عنوان اختراع', type: 'textarea', required: true },
    { name: 'number', label: 'شمارهٔ ثبت', type: 'text' },
    { name: 'registrationDate', label: 'تاریخ ثبت', type: 'date' },
    { name: 'country', label: 'کشور', type: 'text' },
  ],
};

/** First two meaningful fields form the list-row title/subtitle. */
export const optionLabel = (f: FieldDef, v: unknown) => f.options?.find((o) => o[0] === v)?.[1] ?? (v as string);
