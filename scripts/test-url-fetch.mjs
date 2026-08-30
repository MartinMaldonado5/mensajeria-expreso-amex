async function testFetch() {
  const url = 'https://pub-dcb2789e802043768fa5c6c649f9c405.r2.dev/FOLDER%20AMEX/test_image_1.jpg';
  try {
    const res = await fetch(url);
    console.log('Status:', res.status, res.statusText);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log('Body preview:', text.slice(0, 300));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testFetch();
