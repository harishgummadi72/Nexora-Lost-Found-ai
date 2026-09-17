import { pipeline } from '@huggingface/transformers'

let imageFeatureExtractor = null

async function loadDinoV2() {
  if (imageFeatureExtractor) {
    return imageFeatureExtractor
  }

  imageFeatureExtractor = await pipeline(
    'image-feature-extraction',
    'Xenova/dinov2-base'
  )

  return imageFeatureExtractor
}

export async function generateDinoV2Embedding(image) {
  const extractor = await loadDinoV2()

  const features = await extractor(image)

  const allValues = Array.from(features.data)

  // DINOv2 Base:
  // 257 tokens × 768 values
  //
  // The first token is the CLS token.
  const clsEmbedding = allValues.slice(0, 768)

  // L2-normalize the embedding
  let magnitude = 0

  for (const value of clsEmbedding) {
    magnitude += value * value
  }

  magnitude = Math.sqrt(magnitude)

  if (magnitude === 0) {
    throw new Error('Invalid DINOv2 embedding.')
  }

  const normalizedEmbedding = clsEmbedding.map(
    (value) => value / magnitude
  )

  if (normalizedEmbedding.length !== 768) {
    throw new Error(
      `Unexpected embedding size: ${normalizedEmbedding.length}`
    )
  }

  return normalizedEmbedding
}