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
    let fetchUrl = imageUrl;
    const driveMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      fetchUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=view&authuser=0`;
    }

    const imgResp = await fetch(fetchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!imgResp.ok) throw new Error(`이미지를 불러올 수 없어요. 상태코드: ${imgResp.status}`);

    const imgBuffer = await imgResp.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString('base64');
    const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim();

    const prompt = `이 이미지는 수학 시험 문항별 분석표입니다. 표를 읽고 아래 형식의 JSON만 반환하세요. 절대 다른 텍스트를 포함하지 마세요.

반환 형식 (숫자는 반드시 정수):
{"unit":{"단원명":숫자},"type":{"객관식":숫자,"서술형":숫자},"difficulty":{"하":숫자,"중하":숫자,"중":숫자,"중상":숫자,"상":숫자,"최상":숫자},"link":{"교과서":숫자,"학교 부교재":숫자,"비연계":숫자,"학교 프린트":숫자}}

규칙:
1. unit: 출제 단원 컬럼의 값별로 문항 수 집계
2. type: 문제 유형 컬럼 기준
3. difficulty: 난이도 컬럼 기준
4. link: 연계 여부 컬럼 기준
5. 값이 0이면 해당 키 생략
6. JSON 외 어떤 텍스트도 출력 금지`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: prompt }
          ]}],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 2000,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const geminiData = await geminiResp.json();
    if (geminiData.error) throw new Error(`Gemini 오류: ${geminiData.error.message}`);

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    res.status(200).json(result);
  } catch (err) {
    console.error('analyze error:', err);
    res.status(500).json({ error: err.message });
  }
}
