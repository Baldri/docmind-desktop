import { render, screen } from '@testing-library/react'
import { RelevanceIndicator, ConfidenceIndicator } from './RelevanceIndicator'

describe('RelevanceIndicator', () => {
  it('renders nothing for null score', () => {
    const { container } = render(<RelevanceIndicator score={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for undefined score', () => {
    const { container } = render(<RelevanceIndicator score={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for NaN score', () => {
    const { container } = render(<RelevanceIndicator score={NaN} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders percent for valid score', () => {
    render(<RelevanceIndicator score={0.85} />)
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('rounds percent correctly', () => {
    render(<RelevanceIndicator score={0.333} />)
    expect(screen.getByText('33%')).toBeInTheDocument()
  })

  it('shows label when provided', () => {
    render(<RelevanceIndicator score={0.7} label="BM25" />)
    expect(screen.getByText('BM25')).toBeInTheDocument()
  })

  it('hides percent when showPercent is false', () => {
    render(<RelevanceIndicator score={0.7} showPercent={false} />)
    expect(screen.queryByText('70%')).not.toBeInTheDocument()
  })

  it('applies green color for high scores (>=75%)', () => {
    const { container } = render(<RelevanceIndicator score={0.8} />)
    const bar = container.querySelector('.bg-emerald-500')
    expect(bar).toBeInTheDocument()
  })

  it('applies amber color for medium scores (>=50%)', () => {
    const { container } = render(<RelevanceIndicator score={0.6} />)
    const bar = container.querySelector('.bg-amber-500')
    expect(bar).toBeInTheDocument()
  })

  it('applies red color for low scores (<50%)', () => {
    const { container } = render(<RelevanceIndicator score={0.3} />)
    const bar = container.querySelector('.bg-red-500')
    expect(bar).toBeInTheDocument()
  })

  it('sets bar width as percentage', () => {
    const { container } = render(<RelevanceIndicator score={0.65} />)
    const bar = container.querySelector('[style]')
    expect(bar).toHaveStyle({ width: '65%' })
  })

  it('renders with sm size by default', () => {
    const { container } = render(<RelevanceIndicator score={0.5} />)
    const bar = container.querySelector('.h-1\\.5')
    expect(bar).toBeInTheDocument()
  })

  it('renders with md size when specified', () => {
    const { container } = render(<RelevanceIndicator score={0.5} size="md" />)
    const bar = container.querySelector('.h-2')
    expect(bar).toBeInTheDocument()
  })
})

describe('ConfidenceIndicator', () => {
  it('renders nothing for empty sources', () => {
    const { container } = render(<ConfidenceIndicator sources={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for null-score sources', () => {
    const { container } = render(
      <ConfidenceIndicator sources={[{ score: null }, { score: undefined }]} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows source count (singular)', () => {
    render(<ConfidenceIndicator sources={[{ score: 0.8 }]} />)
    expect(screen.getByText('Basiert auf 1 Quelle')).toBeInTheDocument()
  })

  it('shows source count (plural)', () => {
    render(
      <ConfidenceIndicator sources={[{ score: 0.8 }, { score: 0.6 }]} />,
    )
    expect(screen.getByText('Basiert auf 2 Quellen')).toBeInTheDocument()
  })

  it('calculates average score from valid scores', () => {
    render(
      <ConfidenceIndicator sources={[{ score: 0.8 }, { score: 0.6 }]} />,
    )
    // Average = 0.7 → 70%
    expect(screen.getByText('70%')).toBeInTheDocument()
  })

  it('ignores null scores in average', () => {
    render(
      <ConfidenceIndicator sources={[{ score: 0.8 }, { score: null }, { score: 0.6 }]} />,
    )
    // Only 0.8 and 0.6 count → avg 0.7 → shows "3 Quellen" but avg from 2
    expect(screen.getByText('Basiert auf 3 Quellen')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
  })

  it('shows Konfidenz label', () => {
    render(<ConfidenceIndicator sources={[{ score: 0.5 }]} />)
    expect(screen.getByText('Konfidenz')).toBeInTheDocument()
  })
})
