import { Box, Chip, Stack, Typography } from '@mui/material'
import {
  SEGMENT_COLORS,
  MARKER_COLORS,
} from '../../utils/chartLayout'

const LEGEND_ITEMS = [
  { kind: 'runtime' as const, label: 'Runtime' },
  { kind: 'unplanned_production' as const, label: 'Unplanned Production' },
  { kind: 'unknown_downtime' as const, label: 'Unknown Downtime' },
  { kind: 'stoppage' as const, label: 'Stoppage' },
]

interface ChartLegendProps {
  markerCount: number
  totalProduces?: number
  clusterMode?: boolean
  showIndividualProduces?: boolean
  isZoomed: boolean
}

export default function ChartLegend({
  markerCount,
  totalProduces,
  clusterMode = false,
  showIndividualProduces = false,
  isZoomed,
}: ChartLegendProps) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      flexWrap="wrap"
      alignItems="center"
      mb={1.5}
      useFlexGap
    >
      <Typography variant="subtitle2" fontWeight={700} sx={{ mr: 1 }}>
        Production History
      </Typography>
      {LEGEND_ITEMS.map(({ kind, label }) => (
        <Chip
          key={kind}
          size="small"
          label={label}
          sx={{
            bgcolor: SEGMENT_COLORS[kind],
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.7rem',
            height: 22,
          }}
        />
      ))}
      <Chip
        size="small"
        icon={
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: MARKER_COLORS.PASS,
              ml: '6px !important',
            }}
          />
        }
        label="PASS"
        variant="outlined"
        sx={{ fontSize: '0.7rem', height: 22 }}
      />
      <Chip
        size="small"
        label="× FAIL"
        variant="outlined"
        color="error"
        sx={{ fontSize: '0.7rem', height: 22, fontWeight: 700 }}
      />
      {markerCount > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important' }}>
          {clusterMode && totalProduces !== undefined
            ? `${totalProduces.toLocaleString()} passes · ${markerCount.toLocaleString()} hours`
            : showIndividualProduces
              ? `${markerCount.toLocaleString()} markers · exact produces`
              : `${markerCount.toLocaleString()} markers`}
          {isZoomed ? ' · zoomed' : ''}
        </Typography>
      )}
    </Stack>
  )
}
