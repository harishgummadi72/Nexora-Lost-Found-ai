import { useState } from 'react'
import { generateDinoV2Embedding } from './lib/dinov2'

export default function DinoTest() {
  const [status, setStatus] = useState('Waiting for an image...')
  const [embeddingSize, setEmbeddingSize] = useState(null)
  const [preview, setPreview] = useState(null)

  async function handleImage(event) {
    const file = event.target.files?.[0]

    if (!file) return

    const imageUrl = URL.createObjectURL(file)

    setPreview(imageUrl)
    setEmbeddingSize(null)
    setStatus('Running Nexora DINOv2 AI...')

    try {
      const embedding = await generateDinoV2Embedding(imageUrl)

      console.log('Nexora DINOv2 embedding:', embedding)
      console.log('Embedding dimensions:', embedding.length)

      setEmbeddingSize(embedding.length)

      setStatus(
        'Nexora DINOv2 embedding generated successfully! ✅'
      )
    } catch (error) {
      console.error('DINOv2 error:', error)

      setStatus(
        `Error: ${error.message}`
      )
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '40px',
        fontFamily: 'Arial, sans-serif',
        background: '#f5f7fb',
      }}
    >
      <h1>Nexora DINOv2 Test</h1>

      <p>
        Testing Nexora's reusable browser-based AI module.
      </p>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleImage}
      />

      {preview && (
        <div style={{ marginTop: '25px' }}>
          <img
            src={preview}
            alt="Selected item"
            style={{
              maxWidth: '300px',
              maxHeight: '300px',
              borderRadius: '12px',
              objectFit: 'contain',
            }}
          />
        </div>
      )}

      <div style={{ marginTop: '25px' }}>
        <strong>Status:</strong>{' '}
        {status}
      </div>

      {embeddingSize !== null && (
        <div style={{ marginTop: '15px' }}>
          <strong>Embedding dimensions:</strong>{' '}
          {embeddingSize}
        </div>
      )}
    </div>
  )
}