import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

logger = logging.getLogger("eldermed.email")

class EmailService:
    @staticmethod
    def send_email(to_email: str, subject: str, html_body: str) -> bool:
        """Send an HTML email or log to system if SMTP is not enabled."""
        if not settings.EMAIL_ENABLED or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.info(
                f"[SIMULATED EMAIL NOTIFICATION]\n"
                f"To: {to_email}\n"
                f"Subject: {subject}\n"
                f"Body Preview: {html_body[:160]}...\n"
                f"------------------------------------------------"
            )
            return True

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = to_email

            part = MIMEText(html_body, "html")
            msg.attach(part)

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())

            logger.info(f"Email successfully delivered to {to_email} with subject: {subject}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

    @classmethod
    def send_medicine_reminder(cls, to_email: str, patient_name: str, medicine_name: str, dosage: str, scheduled_time: str, instructions: str):
        subject = f"⏰ Medicine Reminder for {patient_name}: {medicine_name} ({scheduled_time})"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background: #ffffff;">
            <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px;">
                <h2 style="color: #0284c7; margin: 0;">ElderMed Reminder</h2>
            </div>
            <p style="font-size: 16px; color: #334155;">Hello {patient_name},</p>
            <p style="font-size: 16px; color: #334155;">It is time to take your scheduled medication:</p>
            <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 8px 0; color: #0369a1; font-size: 20px;">{medicine_name} - {dosage}</h3>
                <p style="margin: 4px 0; color: #0c4a6e;"><strong>Scheduled Time:</strong> {scheduled_time}</p>
                <p style="margin: 4px 0; color: #0c4a6e;"><strong>Instructions:</strong> {instructions or 'Take as prescribed with water.'}</p>
            </div>
            <p style="font-size: 14px; color: #64748b;">Please log in to your ElderMed portal to confirm you have taken your medicine.</p>
        </div>
        """
        return cls.send_email(to_email, subject, html)

    @classmethod
    def send_missed_alert(cls, caregiver_email: str, caregiver_name: str, patient_name: str, medicine_name: str, scheduled_time: str, phone: str):
        subject = f"⚠️ Alert: {patient_name} missed scheduled medicine: {medicine_name}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #ef4444; border-radius: 8px; padding: 24px; background: #ffffff;">
            <div style="border-bottom: 2px solid #ef4444; padding-bottom: 12px; margin-bottom: 16px;">
                <h2 style="color: #dc2626; margin: 0;">⚠️ Caregiver Alert: Missed Medicine</h2>
            </div>
            <p style="font-size: 16px; color: #334155;">Hello {caregiver_name},</p>
            <p style="font-size: 16px; color: #334155;">
                This is an automated alert from ElderMed. <strong>{patient_name}</strong> has not confirmed taking their scheduled medication within the grace period.
            </p>
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 8px 0; color: #b91c1c; font-size: 18px;">{medicine_name}</h3>
                <p style="margin: 4px 0; color: #7f1d1d;"><strong>Scheduled Time:</strong> {scheduled_time}</p>
                <p style="margin: 4px 0; color: #7f1d1d;"><strong>Patient Contact:</strong> {phone or 'Not provided'}</p>
            </div>
            <p style="font-size: 15px; color: #334155;">
                Please check in with {patient_name} to confirm their well-being and medication status.
            </p>
        </div>
        """
        return cls.send_email(caregiver_email, subject, html)
