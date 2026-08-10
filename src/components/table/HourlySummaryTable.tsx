import { memo } from 'react'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { HourlyBucket } from '../../types/api'

interface HourlySummaryTableProps {
  buckets: HourlyBucket[]
}

const ROWS: { key: keyof HourlyBucket; label: string; format?: (v: number) => string }[] = [
  { key: 'total', label: 'Total' },
  { key: 'pass', label: 'Pass' },
  { key: 'fail', label: 'Fail' },
  { key: 'runtime', label: 'Runtime (min)' },
  { key: 'unplannedProduction', label: 'Unplanned Production (min)' },
  { key: 'stoppage', label: 'Stoppage (min)' },
  { key: 'unknownDowntime', label: 'Unknown Downtime (min)' },
  { key: 'idealCycleTime', label: 'Ideal Cycle Time (s)' },
  { key: 'actualCycleTime', label: 'Actual Cycle Time (s)' },
]

function formatCell(value: number | null | string, key: string): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (key === 'idealCycleTime' || key === 'actualCycleTime') {
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }
  return String(value)
}

function HourlySummaryTable({ buckets }: HourlySummaryTableProps) {
  return (
    <Paper elevation={1} sx={{ overflow: 'hidden' }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ p: 2, pb: 1 }}>
        Hourly Production &amp; Downtime Summary
      </Typography>
      <TableContainer sx={{ maxHeight: 480 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 600,
                  bgcolor: 'background.paper',
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  minWidth: 200,
                }}
              >
                Param
              </TableCell>
              {buckets.map((b) => (
                <TableCell key={b.hourStartMs} align="center" sx={{ fontWeight: 600, minWidth: 90 }}>
                  {b.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {ROWS.map(({ key, label }) => (
              <TableRow key={key} hover>
                <TableCell
                  sx={{
                    fontWeight: 500,
                    position: 'sticky',
                    left: 0,
                    bgcolor: 'background.paper',
                    zIndex: 1,
                  }}
                >
                  {label}
                </TableCell>
                {buckets.map((b) => {
                  const value = b[key as keyof HourlyBucket]
                  const display =
                    typeof value === 'number' || value === null
                      ? formatCell(value as number | null, key)
                      : ''
                  return (
                    <TableCell key={b.hourStartMs} align="center">
                      {display}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}

export default memo(HourlySummaryTable)
