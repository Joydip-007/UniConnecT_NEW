import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { PublicUserProfile, ProfileExperience, ProfileEducation } from '@uniconnect/shared'
import { getUserExperience, getUserEducation } from '@/lib/api/users'
import { GhostBtn } from '@/components/Button'
import { AnimatedIcon } from '@/components/AnimatedIcon'
import downloadCloudAnimation from '@/assets/lottie/icons8-download-from-the-cloud-50.json'

interface Props {
  user: PublicUserProfile
}

function fmt(d: string | Date | null | undefined): string {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

// Profile fields are user-controlled — escape everything interpolated into the
// resume document to keep stored HTML from executing in a same-origin window.
function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escMultiline(value: string): string {
  return esc(value).replace(/\n/g, '<br>')
}

function safeHref(url: string): string {
  return /^https?:\/\//i.test(url) ? esc(url) : ''
}

function buildResumeHtml(
  user: PublicUserProfile,
  experience: ProfileExperience[],
  education: ProfileEducation[],
): string {
  const p = user.profile

  const expRows = experience
    .map(
      (e) => `
      <div class="entry">
        <div class="entry-header">
          <div>
            <div class="entry-title">${esc(e.title)}</div>
            <div class="entry-sub">${esc(e.company)}${e.location ? ` · ${esc(e.location)}` : ''}</div>
          </div>
          <div class="entry-date">${fmt(e.startDate)} – ${e.endDate ? fmt(e.endDate) : 'Present'}</div>
        </div>
        ${e.description ? `<div class="entry-desc">${escMultiline(e.description)}</div>` : ''}
      </div>`,
    )
    .join('')

  const eduRows = education
    .map(
      (e) => `
      <div class="entry">
        <div class="entry-header">
          <div>
            <div class="entry-title">${esc(e.institution)}</div>
            <div class="entry-sub">${esc([e.degree, e.fieldOfStudy].filter(Boolean).join(', '))}${e.grade ? ` · ${esc(e.grade)}` : ''}</div>
          </div>
          <div class="entry-date">${esc(e.startYear)}${e.endYear ? ` – ${esc(e.endYear)}` : ' – Present'}</div>
        </div>
        ${e.description ? `<div class="entry-desc">${escMultiline(e.description)}</div>` : ''}
      </div>`,
    )
    .join('')

  const skillsRow =
    p.skills.length > 0
      ? `<section>
           <h2>Skills</h2>
           <div class="skills">${p.skills.map((s) => `<span class="skill">${esc(s)}</span>`).join('')}</div>
         </section>`
      : ''

  const links = [
    p.linkedinUrl && safeHref(p.linkedinUrl) ? `<a href="${safeHref(p.linkedinUrl)}">LinkedIn</a>` : '',
    p.githubUrl && safeHref(p.githubUrl) ? `<a href="${safeHref(p.githubUrl)}">GitHub</a>` : '',
    p.websiteUrl && safeHref(p.websiteUrl) ? `<a href="${safeHref(p.websiteUrl)}">Website</a>` : '',
    p.portfolioUrl && safeHref(p.portfolioUrl) ? `<a href="${safeHref(p.portfolioUrl)}">Portfolio</a>` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${esc(p.fullName)} — Resume</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      line-height: 1.55;
      color: #111;
      background: #fff;
      padding: 40px 48px;
      max-width: 860px;
      margin: 0 auto;
    }
    h1 { font-size: 22px; font-weight: 600; }
    .subtitle { font-size: 13px; color: #555; margin-top: 2px; }
    .meta { font-size: 12px; color: #666; margin-top: 6px; }
    .meta a { color: #2563eb; text-decoration: none; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }
    h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #444; margin-bottom: 12px; }
    section { margin-bottom: 22px; }
    .entry { margin-bottom: 14px; }
    .entry-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .entry-title { font-weight: 600; font-size: 13px; }
    .entry-sub { font-size: 12px; color: #555; }
    .entry-date { font-size: 11px; color: #777; white-space: nowrap; flex-shrink: 0; }
    .entry-desc { font-size: 12px; color: #444; margin-top: 5px; white-space: pre-line; }
    .skills { display: flex; flex-wrap: wrap; gap: 6px; }
    .skill { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 2px 8px; font-size: 11px; }
    @media print {
      body { padding: 20px 28px; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <h1>${esc(p.fullName)}</h1>
  ${p.headline ? `<div class="subtitle">${esc(p.headline)}</div>` : ''}
  <div class="meta">
    ${[
      esc(user.email),
      esc(p.phone ?? ''),
      esc(p.location ?? ''),
      links,
    ]
      .filter(Boolean)
      .join(' · ')}
  </div>

  ${p.bio ? `<hr><section><p style="font-size:13px;color:#333;line-height:1.65">${escMultiline(p.bio)}</p></section>` : ''}

  ${
    experience.length > 0
      ? `<hr><section><h2>Experience</h2>${expRows}</section>`
      : ''
  }

  ${
    education.length > 0
      ? `<hr><section><h2>Education</h2>${eduRows}</section>`
      : ''
  }

  ${p.skills.length > 0 ? `<hr>${skillsRow}` : ''}
</body>
</html>`
}

export function ResumeExportButton({ user }: Props) {
  const [downloadAnimationKey, setDownloadAnimationKey] = useState(0)
  const { data: experience = [] } = useQuery<ProfileExperience[]>({
    queryKey: ['profile', 'experience', user.id],
    queryFn: () => getUserExperience(user.id),
  })

  const { data: education = [] } = useQuery<ProfileEducation[]>({
    queryKey: ['profile', 'education', user.id],
    queryFn: () => getUserEducation(user.id),
  })

  function handleExport() {
    setDownloadAnimationKey((key) => key + 1)
    const html = buildResumeHtml(user, experience, education)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.onload = () => {
      win.focus()
      win.print()
    }
  }

  return (
    <GhostBtn
      onClick={handleExport}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <AnimatedIcon animationData={downloadCloudAnimation} size={18} playKey={downloadAnimationKey} />
      Export resume
    </GhostBtn>
  )
}
