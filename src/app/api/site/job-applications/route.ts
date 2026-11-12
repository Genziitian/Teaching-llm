import { NextRequest } from 'next/server'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { readBody, jsonRes } from '@/lib/site/http'

export const dynamic = 'force-dynamic'

// Public POST (apply) part of the storefront api/job-applications.ts.
// The manager-only GET/PUT/PATCH/DELETE operations stay with the storefront's manager tools (405 here).
export async function POST(request: NextRequest) {
  const res = jsonRes();
  // Original fell back to the anon key when no service role was set; the class port always uses the service-role client.
  const supabase = isStorefrontConfigured() ? storefrontDb() : null;

  // 1. POST: Submit a new job application
  {
    try {
      const {
        role,
        role_title,
        full_name,
        name,
        email,
        phone,
        age,
        gender,
        student_type,
        studentType,
        degree_level,
        degreeLevel,
        courses,
        has_tablet,
        hasTablet,
        experience_and_why,
        experienceAndWhy,
        is_iitm,
        isIITM,
        level,
        subject,
        language,
        cgpa,
        resume_link,
        resumeLink,
        official_email,
        officialEmail,
        is_bs_student,
        isBSStudent,
        is_group_owner,
        isGroupOwner,
        group_link,
        groupLink,
        group_members,
        groupMembers,
        inquiries,
        metadata = {}
      } = await readBody(request);

      const candidateName = (full_name || name || '').trim();
      const candidateEmail = (email || '').trim().toLowerCase();
      const rawPhone = (phone || '').trim();
      const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);

      if (!candidateName || !candidateEmail) {
        return res.status(400).json({ error: 'Name and email are required.' });
      }

      // Name can only be letters and spaces
      if (!/^[a-zA-Z\s.]+$/.test(candidateName)) {
        return res.status(400).json({ error: 'Full name can only contain letters.' });
      }

      // Phone must be 10 digits starting with 6-9
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        return res.status(400).json({ error: 'Phone number must be a valid 10-digit number starting with 6-9.' });
      }

      // Age must be between 15 and 100
      if (age !== undefined && age !== null && String(age).trim() !== '') {
        const numAge = parseInt(String(age), 10);
        if (isNaN(numAge) || numAge < 15 || numAge > 100) {
          return res.status(400).json({ error: 'Age must be between 15 and 100.' });
        }
      }

      const appId = `app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const resolvedRole = role || (role_title?.toLowerCase().includes('campus') ? 'campus-leader' : 'tutor');
      const resolvedRoleTitle = role_title || (resolvedRole === 'campus-leader' ? 'Campus Leaders' : 'Subject Tutor (Faculty)');

      const applicationRecord = {
        id: appId,
        role: resolvedRole,
        role_title: resolvedRoleTitle,
        full_name: candidateName,
        email: candidateEmail,
        phone: cleanPhone || rawPhone,

        // Personal & Background profile
        age: age || null,
        gender: gender || null,
        student_type: student_type || studentType || null,
        degree_level: degree_level || degreeLevel || null,

        // Tutor specific
        courses: Array.isArray(courses) ? courses : (courses ? [courses] : []),
        has_tablet: has_tablet || hasTablet || null,
        experience_and_why: experience_and_why || experienceAndWhy || null,
        is_iitm: is_iitm || isIITM || null,
        level: level || degree_level || degreeLevel || null,
        subject: subject || (Array.isArray(courses) && courses.length > 0 ? courses.join(', ') : null),
        language: language || null,
        cgpa: cgpa || null,
        resume_link: resume_link || resumeLink || null,

        // Campus Leader
        official_email: official_email || officialEmail || null,
        is_bs_student: is_bs_student || isBSStudent || null,
        is_group_owner: is_group_owner || isGroupOwner || null,
        group_link: group_link || groupLink || null,
        group_members: group_members || groupMembers || null,
        inquiries: inquiries || null,

        metadata: {
          ...metadata,
          submitted_at: new Date().toISOString(),
          userAgent: request.headers.get('user-agent') || ''
        },
        status: 'PENDING',
        manager_notes: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (supabase) {
        // Try inserting into job_applications table
        try {
          const { error: insErr } = await supabase.from('job_applications').insert([applicationRecord]);
          if (insErr) {
            console.warn('[Job Applications API] Table insert warning:', insErr.message);
          }
        } catch (e: any) {
          console.warn('[Job Applications API] Supabase insert error:', e.message);
        }

        // Always log to activity_logs as durable ledger
        try {
          await supabase.from('activity_logs').insert({
            email: candidateEmail,
            action: 'JOB_APPLICATION_SUBMITTED',
            metadata: applicationRecord
          });
        } catch (e: any) {
          console.warn('[Job Applications API] activity_logs error:', e.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Application recorded successfully',
        application: applicationRecord
      });
    } catch (err: any) {
      console.error('[Job Applications API] Submission error:', err?.message || 'unknown');
      return res.status(500).json({ error: 'Failed to record application' });
    }
  }

}
