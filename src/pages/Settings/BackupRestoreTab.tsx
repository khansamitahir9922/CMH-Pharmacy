import React, { useState, useEffect } from 'react'
import { Card, Button, Table, Switch, Select, Input, Modal, notification } from 'antd'
import { CloudUploadOutlined, FolderOpenOutlined, RollbackOutlined, ExperimentOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface BackupLogRow {
  id: number
  file_path: string
  file_size: number | null
  status: string
  error_message: string | null
  created_at: string
}

const AUTO_BACKUP_TIMES = [
  { value: 'midnight', label: 'Midnight (00:00)' },
  { value: '6am', label: '6:00 AM' },
  { value: 'noon', label: 'Noon (12:00)' },
  { value: '6pm', label: '6:00 PM' }
]

function formatBytes(n: number | null): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export function BackupRestoreTab(): React.ReactElement {
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [dbFileSize, setDbFileSize] = useState<number | null>(null)
  const [logs, setLogs] = useState<BackupLogRow[]>([])
  const [backupFolder, setBackupFolder] = useState('')
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false)
  const [autoBackupTime, setAutoBackupTime] = useState('midnight')
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [lastBackupResult, setLastBackupResult] = useState<{ filePath: string; fileSize: number } | null>(null)

  const fetchLogs = (): void => {
    window.api.invoke<BackupLogRow[]>('backup:getLogs').then((data) => setLogs(data ?? []))
  }

  const fetchDbFileSize = (): void => {
    window.api.invoke<{ path: string; sizeBytes: number }>('backup:getDbFileSize').then((res) => {
      if (res?.sizeBytes != null) setDbFileSize(res.sizeBytes)
    })
  }

  const loadSettings = (): void => {
    window.api.invoke<Record<string, string | null>>('settings:getAll').then((data) => {
      if (data) {
        setBackupFolder(data.backup_folder ?? '')
        setAutoBackupEnabled(data.auto_backup_enabled === 'true')
        setAutoBackupTime(data.auto_backup_time ?? 'midnight')
      }
    })
  }

  useEffect(() => {
    fetchLogs()
    loadSettings()
    fetchDbFileSize()
  }, [])

  const handleCreateBackup = (): void => {
    setCreating(true)
    setLastBackupResult(null)
    window.api
      .invoke<{ success: boolean; filePath?: string; fileSize?: number; error?: string }>('backup:create')
      .then((res) => {
        if (res?.success && res.filePath != null) {
          setLastBackupResult({ filePath: res.filePath, fileSize: res.fileSize ?? 0 })
          notification.success({
            message: 'Backup created',
            description: `Saved to ${res.filePath} (${formatBytes(res.fileSize ?? 0)})`
          })
          fetchLogs()
        } else {
          notification.error({ message: res?.error ?? 'Backup failed' })
        }
      })
      .catch(() => notification.error({ message: 'Backup failed' }))
      .finally(() => setCreating(false))
  }

  const handleBrowse = (): void => {
    window.api.invoke<string | null>('backup:selectFolder').then((path) => {
      if (path) {
        setBackupFolder(path)
        window.api.invoke('settings:update', { key: 'backup_folder', value: path })
      }
    })
  }

  const handleAutoBackupToggle = (enabled: boolean): void => {
    setAutoBackupEnabled(enabled)
    window.api.invoke('backup:setAutoBackup', { enabled }).then(() => {
      window.api.invoke('settings:update', { key: 'auto_backup_enabled', value: enabled ? 'true' : 'false' })
    })
  }

  const handleAutoBackupTimeChange = (time: string): void => {
    setAutoBackupTime(time)
    window.api.invoke('backup:setAutoBackup', { enabled: autoBackupEnabled, time })
    window.api.invoke('settings:update', { key: 'auto_backup_time', value: time })
  }

  const handleRestoreClick = (): void => {
    setRestoreConfirmOpen(true)
  }

  const handleSeedDummy = (): void => {
    setSeeding(true)
    const count = 10_000
    window.api
      .invoke<number>('medicines:seedDummy', count)
      .then((added) => {
        notification.success({
          message: 'Dummy data added',
          description: `${added.toLocaleString()} dummy medicines (with stock) were added. Check Medicines list and database size below.`
        })
        fetchDbFileSize()
      })
      .catch((e) => notification.error({ message: 'Seed failed', description: String(e?.message || e) }))
      .finally(() => setSeeding(false))
  }

  const handleRestoreConfirm = (): void => {
    setRestoreConfirmOpen(false)
    window.api.invoke<string | null>('backup:showRestoreFileDialog').then((path) => {
      if (!path) return
      setRestoring(true)
      window.api
        .invoke<{ success: boolean; error?: string }>('backup:restore', path)
        .then((res) => {
          if (res?.success) {
            notification.success({ message: 'Restore complete. Restarting...' })
            window.api.invoke('app:restart')
          } else {
            notification.error({ message: res?.error ?? 'Restore failed' })
            setRestoring(false)
          }
        })
        .catch(() => {
          notification.error({ message: 'Restore failed' })
          setRestoring(false)
        })
    })
  }

  const columns: ColumnsType<BackupLogRow> = [
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', width: 120, render: (v) => (v ? new Date(v).toLocaleDateString() : '—') },
    { title: 'Time', dataIndex: 'created_at', key: 'time', width: 90, render: (v) => (v ? new Date(v).toLocaleTimeString() : '—') },
    { title: 'File', dataIndex: 'file_path', key: 'file_path', ellipsis: true, render: (v) => (v ? v.replace(/^.*[\\/]/, '') : '—') },
    { title: 'Size', dataIndex: 'file_size', key: 'file_size', width: 90, render: formatBytes },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 80 }
  ]

  return (
    <Card title="Backup & Restore">
      {dbFileSize != null && (
        <p style={{ marginBottom: 16, color: '#666' }}>
          Database file size: <strong>{formatBytes(dbFileSize)}</strong>
        </p>
      )}
      <div style={{ marginBottom: 24 }}>
        <Button
          type="primary"
          icon={<CloudUploadOutlined />}
          onClick={handleCreateBackup}
          loading={creating}
          style={{ marginRight: 8 }}
        >
          Create Backup Now
        </Button>
        {lastBackupResult && (
          <span style={{ marginLeft: 8, color: '#52c41a' }}>
            Saved: {lastBackupResult.filePath} ({formatBytes(lastBackupResult.fileSize)})
          </span>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>Backup folder</label>
        <Input.Group compact style={{ display: 'flex', maxWidth: 500 }}>
          <Input
          value={backupFolder}
          onChange={(e) => setBackupFolder(e.target.value)}
          onBlur={() => window.api.invoke('settings:update', { key: 'backup_folder', value: backupFolder })}
          placeholder="Default: app data folder"
        />
          <Button icon={<FolderOpenOutlined />} onClick={handleBrowse}>
            Browse
          </Button>
        </Input.Group>
      </div>

      <div style={{ marginBottom: 24 }}>
        <Switch checked={autoBackupEnabled} onChange={handleAutoBackupToggle} style={{ marginRight: 8 }} />
        <span>Enable daily auto-backup</span>
        {autoBackupEnabled && (
          <>
            <span style={{ marginLeft: 16 }}>Time:</span>
            <Select
              value={autoBackupTime}
              onChange={handleAutoBackupTimeChange}
              options={AUTO_BACKUP_TIMES}
              style={{ width: 160, marginLeft: 8 }}
            />
          </>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Button
          danger
          icon={<RollbackOutlined />}
          onClick={handleRestoreClick}
          loading={restoring}
        >
          Restore from Backup
        </Button>
      </div>

      <Card type="inner" title="Load test data" style={{ marginTop: 24 }}>
        <p style={{ marginBottom: 12, color: '#666' }}>
          Add 10,000 dummy medicines (with stock and categories) to test performance and see how the database size grows.
        </p>
        <Button
          icon={<ExperimentOutlined />}
          onClick={handleSeedDummy}
          loading={seeding}
        >
          Seed 10,000 dummy medicines
        </Button>
      </Card>

      <Table
        rowKey="id"
        dataSource={logs}
        columns={columns}
        pagination={{ pageSize: 10 }}
        size="small"
        locale={{ emptyText: 'No backups yet.' }}
      />

      <Modal
        title="Restore from Backup"
        open={restoreConfirmOpen}
        onCancel={() => setRestoreConfirmOpen(false)}
        onOk={handleRestoreConfirm}
        okText="Select backup file..."
        cancelText="Cancel"
      >
        <p><strong style={{ color: '#ff4d4f' }}>WARNING:</strong> Restoring will replace the current database with the backup. All data added after the backup was created will be lost. The application will restart after restore.</p>
      </Modal>
    </Card>
  )
}
