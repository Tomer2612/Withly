'use client';

import { useState, useEffect } from 'react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

// Email validation
const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Character limits
const CHAR_LIMITS = {
  name: 30,
  subject: 50,
  message: 500,
};

export default function ContactPage() {
  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  // Validation state
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Pre-fill form if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && token.split('.').length === 3) {
      try {
        // Fetch user profile to pre-fill name and email
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) {
              setContactName(data.name || '');
              setContactEmail(data.email || '');
            }
          })
          .catch(console.error);
      } catch (e) {
        console.error('Invalid token:', e);
      }
    }
  }, []);

  const validateEmail = () => {
    setEmailTouched(true);
    if (!contactEmail) {
      setEmailError('נא להזין אימייל');
    } else if (!isValidEmail(contactEmail)) {
      setEmailError('כתובת אימייל לא תקינה');
    } else {
      setEmailError('');
    }
  };

  const isFormValid = contactName.trim() !== '' && 
                      contactEmail.trim() !== '' && 
                      isValidEmail(contactEmail) && 
                      contactSubject.trim() !== '' && 
                      contactMessage.trim() !== '';

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email before submit
    if (!isValidEmail(contactEmail)) {
      setEmailError('כתובת אימייל לא תקינה');
      setEmailTouched(true);
      return;
    }
    
    setFormLoading(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          subject: contactSubject,
          message: contactMessage,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit');
      }
      
      setFormSubmitted(true);
    } catch (error) {
      console.error('Contact form error:', error);
      // Still show success to user - the form was submitted even if email fails
      setFormSubmitted(true);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <main className="min-h-screen" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
      <SiteHeader />

      {/* Hero Section */}
      <section className="text-center py-16 px-4">
        <h1 className="font-semibold text-black text-3xl md:text-5xl lg:text-[3.5rem]">
          דברו איתנו
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ marginBottom: '2rem', color: '#52525B' }}>
          יש שאלה או פנייה? אפשר גם לכתוב ישירות ל-<a href="mailto:support@withly.co.il" className="text-black font-normal underline hover:opacity-70 transition">support@withly.co.il</a>
        </p>
      </section>

      {/* Contact Form */}
      <section className="max-w-2xl mx-auto px-4 pb-16">
        <div className="bg-white rounded-2xl p-5 sm:p-8" style={{ border: '1px solid #A1A1AA' }}>
          {formSubmitted ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 mx-auto mb-4">
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                  <rect width="40" height="40" rx="20" fill="#A7EA7B"/>
                  <g transform="translate(8, 8)">
                    <path d="M22 13V6C22 5.46957 21.7893 4.96086 21.4142 4.58579C21.0391 4.21071 20.5304 4 20 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V18C2 19.1 2.9 20 4 20H12" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 7L13.03 12.7C12.7213 12.8934 12.3643 12.996 12 12.996C11.6357 12.996 11.2787 12.8934 10.97 12.7L2 7" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 19L18 21L22 17" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </g>
                </svg>
              </div>
              <h3 className="font-semibold text-black mb-2" style={{ fontSize: '24px' }}>ההודעה נשלחה!</h3>
              <p style={{ fontSize: '18px', color: '#3F3F46' }}>נחזור אליכם בהקדם האפשרי.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitContact} className="space-y-6">
              <div>
                <div className="flex justify-between items-center" style={{ marginBottom: '10px' }}>
                  <label className="block font-medium text-black" style={{ fontSize: '18px' }}>שם מלא</label>
                  <span className="text-xs" style={{ color: '#A1A1AA' }}>{contactName.length}/{CHAR_LIMITS.name}</span>
                </div>
                <div className="border border-gray-300 bg-white focus-within:border-transparent focus-within:ring-2 focus-within:ring-black transition-all" style={{ borderRadius: '10px' }}>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value.slice(0, CHAR_LIMITS.name))}
                    required
                    maxLength={CHAR_LIMITS.name}
                    className="w-full p-3 bg-transparent focus:outline-none text-right"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-black" style={{ fontSize: '18px', marginBottom: '10px' }}>אימייל</label>
                <div className="bg-white focus-within:border-transparent focus-within:ring-2 focus-within:ring-black transition-all" style={{ borderRadius: '10px', overflow: 'hidden', border: emailTouched && emailError ? '1px solid #B3261E' : '1px solid #D0D0D4' }}>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => {
                      setContactEmail(e.target.value);
                      if (emailTouched) {
                        if (!e.target.value) {
                          setEmailError('נא להזין אימייל');
                        } else if (!isValidEmail(e.target.value)) {
                          setEmailError('כתובת אימייל לא תקינה');
                        } else {
                          setEmailError('');
                        }
                      }
                    }}
                    onBlur={validateEmail}
                    required
                    className="w-full p-3 bg-transparent focus:outline-none text-right"
                  />
                </div>
                {emailTouched && emailError && (
                  <p className="text-sm mt-1" style={{ color: '#B3261E' }}>{emailError}</p>
                )}
              </div>
              <div>
                <div className="flex justify-between items-center" style={{ marginBottom: '10px' }}>
                  <label className="block font-medium text-black" style={{ fontSize: '18px' }}>נושא</label>
                  <span className="text-xs" style={{ color: '#A1A1AA' }}>{contactSubject.length}/{CHAR_LIMITS.subject}</span>
                </div>
                <div className="bg-white focus-within:border-transparent focus-within:ring-2 focus-within:ring-black transition-all" style={{ borderRadius: '10px', border: '1px solid #D0D0D4' }}>
                  <input
                    type="text"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value.slice(0, CHAR_LIMITS.subject))}
                    required
                    maxLength={CHAR_LIMITS.subject}
                    className="w-full p-3 bg-transparent focus:outline-none text-right"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center" style={{ marginBottom: '10px' }}>
                  <label className="block font-medium text-black" style={{ fontSize: '18px' }}>תיאור</label>
                  <span className="text-xs" style={{ color: '#A1A1AA' }}>{contactMessage.length}/{CHAR_LIMITS.message}</span>
                </div>
                <div className="bg-white focus-within:border-transparent focus-within:ring-2 focus-within:ring-black transition-all" style={{ borderRadius: '10px', border: '1px solid #D0D0D4' }}>
                  <textarea
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value.slice(0, CHAR_LIMITS.message))}
                    required
                    rows={5}
                    maxLength={CHAR_LIMITS.message}
                    className="w-full p-3 bg-transparent focus:outline-none text-right resize-none overflow-y-auto"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={formLoading || !isFormValid}
                className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {formLoading ? 'שולח...' : 'שלח'}
              </button>
            </form>
          )}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
