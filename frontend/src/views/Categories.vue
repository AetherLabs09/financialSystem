<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>收支类目管理</span>
          <el-button type="primary" @click="handleAdd">新增类目</el-button>
        </div>
      </template>
      <el-tabs v-model="activeType" @tab-change="loadData">
        <el-tab-pane label="收入类目" name="income" />
        <el-tab-pane label="支出类目" name="expense" />
      </el-tabs>
      <el-table :data="tableData" stripe>
        <el-table-column prop="name" label="类目名称" />
        <el-table-column prop="sort_order" label="排序" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑类目' : '新增类目'" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="类目名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio value="income">收入</el-radio>
            <el-radio value="expense">支出</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/categories'

const activeType = ref('income')
const tableData = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()

const form = reactive({
  id: null,
  name: '',
  type: 'income',
  sortOrder: 0,
  status: 1
})

const rules = {
  name: [{ required: true, message: '请输入类目名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }]
}

const loadData = async () => {
  const res = await getCategories({ type: activeType.value })
  tableData.value = res
}

const handleAdd = () => {
  isEdit.value = false
  form.id = null
  form.name = ''
  form.type = activeType.value
  form.sortOrder = 0
  form.status = 1
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  form.id = row.id
  form.name = row.name
  form.type = row.type
  form.sortOrder = row.sort_order
  form.status = row.status
  dialogVisible.value = true
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm('确定要删除该类目吗？', '提示', { type: 'warning' })
  await deleteCategory(row.id)
  ElMessage.success('删除成功')
  loadData()
}

const submitForm = async () => {
  await formRef.value.validate()
  const data = {
    name: form.name,
    type: form.type,
    sortOrder: form.sortOrder,
    status: form.status
  }
  if (isEdit.value) {
    await updateCategory(form.id, data)
    ElMessage.success('更新成功')
  } else {
    await createCategory(data)
    ElMessage.success('添加成功')
  }
  dialogVisible.value = false
  loadData()
}

onMounted(() => {
  loadData()
})
</script>
