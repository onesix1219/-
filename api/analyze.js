export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'Missing imageUrl' });

  try {
    // Google Drive URL을 직접 다운로드 URL로 변환
    let fetchUrl = imageUrl;
    const driveMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      fetchUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=view&authuser=0`;
    }

    // 이미지 가져오기
    const imgResp = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!imgResp.ok) {
      throw new Error(`이미지를 불러올 수 없어요. 상태코드: ${imgResp.status}`);
    }

    const imgBuffer = await imgResp.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString('base64');
    const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim();

    const prompt = `이 이미지는 수학 시험 문항별 분석표입니다.
표에서 다음 4가지 정보를 추출하여 JSON으로만 반환하세요. 설명 없이 JSON만 출력하세요.

{
  "unit": {"단원명": 문항수},
  "type": {"객관식": 문항수, "서술형": 문항수},
  "difficulty": {"하": 문항수, "중하": 문항수, "중": 문항수, "중상": 문항수, "상": 문항수, "최상": 문항수},
  "link": {"교과서": 문항수, "학교 부교재": 문항수, "비연계": 문항수, "학교 프린트": 문항수}
}

규칙:
- unit: 출제 단원 컬럼 기준으로 집계
- type: 문제 유형 컬럼 기준
- difficulty: 난이도 컬럼 기준
- link: 연계 여부 컬럼 기준
- 값이 0인 항목은 생략
- 반드시 JSON만 반환, 마크다운 없이`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000
          }
        })
      }
    );

    const geminiData = await geminiResp.json();

    if (geminiData.error) {
      throw new Error(`Gemini 오류: ${geminiData.error.message}`);
    }

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    res.status(200).json(result);
  } catch (err) {
    console.error('analyze error:', err);
    res.status(500).json({ error: err.message });
  }
}
