import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiUrl, model } = body;

    if (!apiUrl || !model) {
      return NextResponse.json(
        { error: 'Missing apiUrl or model' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    const resolvedApiUrl = apiUrl.startsWith('/')
      ? `${request.nextUrl.origin}${apiUrl}`
      : apiUrl;
    const baseApiUrl = resolvedApiUrl.replace(/\/+$/, '');

    const response = await fetch(`${baseApiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Respond with "OK" if you can read this.' }],
        temperature: 0.7,
        max_tokens: 50,
      }),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}: ${error}`,
        duration,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({
        success: false,
        error: 'No content in response',
        duration,
      });
    }

    return NextResponse.json({
      success: true,
      response: content,
      duration,
      model: data.model || model,
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Connection failed',
    });
  }
}
