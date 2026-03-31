import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { name, email, communityLink, painpoint } = await request.json();

    // Validate required fields
    if (!name || !email || !communityLink) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof name !== 'string' || typeof email !== 'string' || typeof communityLink !== 'string') {
      return NextResponse.json({ error: 'Invalid field types' }, { status: 400 });
    }

    if (name.length > 50 || email.length > 256 || communityLink.length > 256) {
      return NextResponse.json({ error: 'Field too long' }, { status: 400 });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // URL validation
    try {
      new URL(communityLink);
    } catch {
      return NextResponse.json({ error: 'Invalid community link' }, { status: 400 });
    }

    // Build message for the contact endpoint
    const messageParts = [`קישור לקהילה: ${communityLink}`];
    if (painpoint && typeof painpoint === 'string') {
      messageParts.push(`אתגר בתפעול הקהילה: ${painpoint.slice(0, 5000)}`);
    }
    const message = messageParts.join('\n\n');

    // Forward to NestJS contact endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        subject: 'רישום לבטא',
        message,
      }),
    });

    if (!response.ok) {
      throw new Error('Backend error');
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
