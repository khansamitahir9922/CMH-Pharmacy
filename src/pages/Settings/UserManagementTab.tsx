import React, { useState, useEffect } from 'react'
import { Table, Button, Card, Modal, Form, Input, Select, Switch, notification } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAuthStore } from '@/store/authStore'

interface UserRow {
  id: number
  full_name: string
  username: string
  role: string
  is_active: boolean
  last_login: string | null
  created_at: string
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'dataentry', label: 'Data Entry' }
]

export function UserManagementTab(): React.ReactElement {
  const { currentUser } = useAuthStore()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [targetUser, setTargetUser] = useState<UserRow | null>(null)
  const [editRole, setEditRole] = useState<string>('dataentry')
  const [editActive, setEditActive] = useState(true)
  const [addForm] = Form.useForm()
  const [resetForm] = Form.useForm()

  const fetchUsers = (): void => {
    setLoading(true)
    window.api
      .invoke<UserRow[]>('users:getAll')
      .then((data) => setUsers(data ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleAdd = (): void => {
    addForm.resetFields()
    setAddOpen(true)
  }

  const handleAddSubmit = (): void => {
    addForm.validateFields().then((values) => {
      if (values.password !== values.confirmPassword) {
        notification.error({ message: 'Passwords do not match' })
        return
      }
      window.api
        .invoke<{ success: boolean; id?: number; error?: string }>('users:create', {
          full_name: values.full_name,
          username: values.username,
          password: values.password,
          role: values.role ?? 'dataentry'
        })
        .then((res) => {
          if (res?.success) {
            notification.success({ message: 'User created' })
            setAddOpen(false)
            fetchUsers()
          } else {
            notification.error({ message: res?.error ?? 'Failed to create user' })
          }
        })
        .catch(() => notification.error({ message: 'Failed to create user' }))
    })
  }

  const handleEdit = (user: UserRow): void => {
    setTargetUser(user)
    setEditRole(user.role)
    setEditActive(user.is_active)
    setEditOpen(true)
  }

  const handleEditSubmit = (): void => {
    if (!targetUser) return
    const role = editRole
    const is_active = editActive
    window.api
      .invoke<{ success: boolean; error?: string }>('users:update', {
        id: targetUser.id,
        currentUserId: currentUser?.id ?? 0,
        role,
        is_active
      })
      .then((res) => {
        if (res?.success) {
          notification.success({ message: 'User updated' })
          setEditOpen(false)
          setTargetUser(null)
          fetchUsers()
        } else {
          notification.error({ message: res?.error ?? 'Update failed' })
        }
      })
  }

  const handleResetPassword = (user: UserRow): void => {
    setTargetUser(user)
    resetForm.resetFields()
    setResetOpen(true)
  }

  const handleResetSubmit = (): void => {
    resetForm.validateFields().then((values) => {
      if (!targetUser) return
      if (values.newPassword !== values.confirmPassword) {
        notification.error({ message: 'Passwords do not match' })
        return
      }
      window.api
        .invoke<{ success: boolean; error?: string }>('users:resetPassword', {
          userId: targetUser.id,
          newPassword: values.newPassword
        })
        .then((res) => {
          if (res?.success) {
            notification.success({ message: 'Password reset' })
            setResetOpen(false)
            setTargetUser(null)
          } else {
            notification.error({ message: res?.error ?? 'Reset failed' })
          }
        })
    })
  }

  const columns: ColumnsType<UserRow> = [
    { title: 'Full Name', dataIndex: 'full_name', key: 'full_name' },
    { title: 'Username', dataIndex: 'username', key: 'username' },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (v) => String(v).charAt(0).toUpperCase() + String(v).slice(1) },
    { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (v) => (v ? 'Active' : 'Inactive') },
    {
      title: 'Last Login',
      dataIndex: 'last_login',
      key: 'last_login',
      render: (v) => (v ? new Date(v).toLocaleString() : '—')
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const isSelf = record.id === currentUser?.id
        return (
          <>
            <Button type="link" size="small" onClick={() => handleEdit(record)}>
              Edit
            </Button>
            <Button type="link" size="small" onClick={() => handleResetPassword(record)}>
              Reset Password
            </Button>
          </>
        )
      }
    }
  ]

  return (
    <Card
      title="User Management"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add User
        </Button>
      }
    >
      <Table
        rowKey="id"
        dataSource={users}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: 'No users found.' }}
      />

      <Modal
        title="Add User"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => addForm.submit()}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" onFinish={handleAddSubmit}>
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role" initialValue="dataentry">
            <Select options={ROLES} />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 4 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="confirmPassword" label="Confirm Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Edit User"
        open={editOpen}
        onCancel={() => { setEditOpen(false); setTargetUser(null) }}
        onOk={() => handleEditSubmit()}
        destroyOnClose
      >
        {targetUser && (
          <div>
            <p><strong>{targetUser.full_name}</strong> ({targetUser.username})</p>
            <Form layout="vertical">
              <Form.Item label="Role">
                <Select
                  options={ROLES}
                  value={editRole}
                  onChange={setEditRole}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item label="Active">
                <Switch checked={editActive} onChange={setEditActive} />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title="Reset Password"
        open={resetOpen}
        onCancel={() => { setResetOpen(false); setTargetUser(null) }}
        onOk={() => resetForm.submit()}
        destroyOnClose
      >
        {targetUser && (
          <p style={{ marginBottom: 16 }}>Reset password for <strong>{targetUser.full_name}</strong></p>
        )}
        <Form form={resetForm} layout="vertical" onFinish={handleResetSubmit}>
          <Form.Item name="newPassword" label="New Password" rules={[{ required: true, min: 4 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="confirmPassword" label="Confirm Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
