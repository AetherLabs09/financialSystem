<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button type="primary" @click="handleAdd">新增用户</el-button>
        </div>
      </template>
      <el-table :data="tableData" stripe>
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="real_name" label="姓名" width="120" />
        <el-table-column prop="role" label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : row.role === 'accountant' ? 'success' : ''">
              {{ roleMap[row.role] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="权限" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.permissions?.map(p => permissionMap[p] || p).join('、') || '无' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '正常' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(row)" v-if="row.id !== currentUserId">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑用户' : '新增用户'" width="600px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model="form.realName" />
        </el-form-item>
        <el-form-item label="密码" prop="password" v-if="!isEdit">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" @change="handleRoleChange">
            <el-option label="管理员" value="admin" />
            <el-option label="财务人员" value="accountant" />
            <el-option label="操作员" value="operator" />
            <el-option label="只读账号" value="viewer" />
          </el-select>
        </el-form-item>
        <el-form-item label="权限" prop="permissions" v-if="form.role !== 'admin'">
          <el-checkbox-group v-model="form.permissions">
            <el-checkbox v-for="(label, key) in permissionMap" :key="key" :value="key">{{ label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">正常</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>操作日志</span>
        </div>
      </template>
      <el-table :data="logs" stripe max-height="400">
        <el-table-column prop="username" label="用户" width="100" />
        <el-table-column prop="action" label="操作" width="100" />
        <el-table-column prop="module" label="模块" width="100" />
        <el-table-column prop="details" label="详情" show-overflow-tooltip />
        <el-table-column prop="created_at" label="时间" width="180" />
      </el-table>
      <el-pagination
        v-model:current-page="logPagination.page"
        v-model:page-size="logPagination.pageSize"
        :total="logPagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadLogs"
        @current-change="loadLogs"
        style="margin-top: 20px; justify-content: flex-end"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUsers, createUser, updateUser, deleteUser, getAuditLogs } from '../api/users'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const currentUserId = computed(() => userStore.userInfo?.id)

const tableData = ref([])
const logs = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()

const logPagination = reactive({ page: 1, pageSize: 20, total: 0 })

const roleMap = { admin: '管理员', accountant: '财务人员', operator: '操作员', viewer: '只读账号' }

const permissionMap = {
  'category:read': '类目查看',
  'category:write': '类目编辑',
  'transaction:read': '收支查看',
  'transaction:write': '收支编辑',
  'partner:read': '往来单位查看',
  'partner:write': '往来单位编辑',
  'receivable:read': '应收应付查看',
  'receivable:write': '应收应付编辑',
  'budget:read': '预算查看',
  'budget:write': '预算编辑',
  'reimbursement:approve': '报销审批',
  'reimbursement:pay': '报销打款',
  'user:read': '用户查看',
  'user:write': '用户编辑',
  'setting:read': '设置查看',
  'setting:write': '设置编辑'
}

const form = reactive({
  id: null,
  username: '',
  password: '',
  realName: '',
  role: 'operator',
  permissions: [],
  status: 1
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  realName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

const loadData = async () => {
  tableData.value = await getUsers({})
}

const loadLogs = async () => {
  const res = await getAuditLogs({ page: logPagination.page, pageSize: logPagination.pageSize })
  logs.value = res.list
  logPagination.total = res.total
}

const handleRoleChange = () => {
  if (form.role === 'admin') {
    form.permissions = ['all']
  } else {
    form.permissions = []
  }
}

const handleAdd = () => {
  isEdit.value = false
  form.id = null
  form.username = ''
  form.password = ''
  form.realName = ''
  form.role = 'operator'
  form.permissions = []
  form.status = 1
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  form.id = row.id
  form.username = row.username
  form.password = ''
  form.realName = row.real_name
  form.role = row.role
  form.permissions = row.permissions || []
  form.status = row.status
  dialogVisible.value = true
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm('确定要删除该用户吗？', '提示', { type: 'warning' })
  await deleteUser(row.id)
  ElMessage.success('删除成功')
  loadData()
}

const submitForm = async () => {
  await formRef.value.validate()
  const data = {
    realName: form.realName,
    role: form.role,
    permissions: form.role === 'admin' ? ['all'] : form.permissions,
    status: form.status
  }
  if (!isEdit.value) {
    data.username = form.username
    data.password = form.password
    await createUser(data)
    ElMessage.success('添加成功')
  } else {
    if (form.password) {
      data.password = form.password
    }
    await updateUser(form.id, data)
    ElMessage.success('更新成功')
  }
  dialogVisible.value = false
  loadData()
}

onMounted(() => {
  loadData()
  loadLogs()
})
</script>
