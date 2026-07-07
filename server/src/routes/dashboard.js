import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

function formatJob(row) {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    type: row.type,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    approvalStatus: row.approval_status || 'approved',
    applicationCount: row.application_count,
    pendingApplications: row.pending_applications,
  };
}

function formatApplication(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    status: row.status,
    matchScore: row.match_score,
    createdAt: row.created_at,
    jobTitle: row.job_title,
    jobCompany: row.job_company,
  };
}

router.get('/seeker', authRequired, (req, res) => {
  const applications = db
    .prepare(
      `SELECT applications.*, jobs.title AS job_title, jobs.company AS job_company
       FROM applications
       JOIN jobs ON applications.job_id = jobs.id
       WHERE applications.user_id = ?
       ORDER BY applications.created_at DESC
       LIMIT 10`
    )
    .all(req.user.id);

  const stats = {
    totalApplications: db
      .prepare('SELECT COUNT(*) AS count FROM applications WHERE user_id = ?')
      .get(req.user.id).count,
    pending: db
      .prepare("SELECT COUNT(*) AS count FROM applications WHERE user_id = ? AND status = 'pending'")
      .get(req.user.id).count,
    accepted: db
      .prepare("SELECT COUNT(*) AS count FROM applications WHERE user_id = ? AND status = 'accepted'")
      .get(req.user.id).count,
  };

  res.json({
    stats,
    recentApplications: applications.map(formatApplication),
  });
});

router.get('/poster', authRequired, (req, res) => {
  const jobs = db
    .prepare(
      `SELECT jobs.*,
              COUNT(applications.id) AS application_count,
              SUM(CASE WHEN applications.status = 'pending' THEN 1 ELSE 0 END) AS pending_applications
       FROM jobs
       LEFT JOIN applications ON applications.job_id = jobs.id
       WHERE jobs.posted_by = ?
       GROUP BY jobs.id
       ORDER BY jobs.created_at DESC`
    )
    .all(req.user.id);

  const stats = {
    totalListings: jobs.length,
    totalApplications: db
      .prepare(
        `SELECT COUNT(*) AS count FROM applications
         JOIN jobs ON applications.job_id = jobs.id
         WHERE jobs.posted_by = ?`
      )
      .get(req.user.id).count,
    pendingReview: db
      .prepare(
        `SELECT COUNT(*) AS count FROM applications
         JOIN jobs ON applications.job_id = jobs.id
         WHERE jobs.posted_by = ? AND applications.status = 'pending'`
      )
      .get(req.user.id).count,
  };

  const recentApplications = db
    .prepare(
      `SELECT applications.*, jobs.title AS job_title, jobs.company AS job_company,
              users.name AS applicant_name, users.email AS applicant_email
       FROM applications
       JOIN jobs ON applications.job_id = jobs.id
       JOIN users ON applications.user_id = users.id
       WHERE jobs.posted_by = ?
       ORDER BY applications.created_at DESC
       LIMIT 10`
    )
    .all(req.user.id)
    .map((row) => ({
      id: row.id,
      jobId: row.job_id,
      jobTitle: row.job_title,
      jobCompany: row.job_company,
      applicantName: row.applicant_name,
      applicantEmail: row.applicant_email,
      status: row.status,
      matchScore: row.match_score,
      createdAt: row.created_at,
    }));

  res.json({
    stats,
    listings: jobs.map(formatJob),
    recentApplications,
  });
});

export default router;
