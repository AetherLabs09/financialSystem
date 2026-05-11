<template>
  <div>
    <el-card style="margin-bottom: 20px">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="类型">
          <el-select v-model="searchForm.type" clearable placeholder="全部">
            <el-option label="客户" value="customer" />
            <el-option label="供应商" value="supplier" />
            <el-option label="其他" value="both" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="名称/联系人/电话" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="resetSearch">重置</el-button>
          <el-button type="success" @click="handleAdd">新增</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="tableData" stripe>
        <el-table-column prop="name" label="名称" width="200" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag>{{ typeMap[row.type] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="contact" label="联系人" width="100" />
        <el-table-column prop="phone" label="电话" width="150" />
        <el-table-column prop="address" label="地址" show-overflow-tooltip />
        <el-table-column prop="current_debt" label="当前欠款" width="120">
          <template #default="{ row }">
            <span :class="row.current_debt > 0 ? 'expense' : 'income'">
              {{ formatMoney(row.current_debt) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '正常' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleView(row)">详情</el-button>
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑往来单位' : '新增往来单位'" width="600px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择">
            <el-option label="客户" value="customer" />
            <el-option label="供应商" value="supplier" />
            <el-option label="其他" value="both" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="form.contact" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="form.address" />
        </el-form-item>
        <el-form-item label="期初欠款">
          <el-input-number v-model="form.initialDebt" :precision="2" style="width: 200px" />
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

    <el-dialog v-model="detailVisible" title="往来单位详情" width="800px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="名称">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ typeMap[detail.type] }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ detail.contact }}</el-descriptions-item>
        <el-descriptions-item label="电话">{{ detail.phone }}</el-descriptions-item>
        <el-descriptions-item label="地址" :span="2">{{ detail.address }}</el-descriptions-item>
        <el-descriptions-item label="期初欠款">{{ formatMoney(detail.initial_debt) }}</el-descriptions-item>
        <el-descriptions-item label="当前欠款">{{ formatMoney(detail.current_debt) }}</el-descriptions-item>
      </el-descriptions>
      <h4 style="margin: 20px 0 10px">关联收支记录</h4>
      <el-table :data="detail.transactions || []" max-height="300">
        <el-table-column prop="serial_no" label="流水号" width="180" />
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.type === 'income' ? 'success' : 'danger'">
              {{ row.type === 'income' ? '收入' : '支出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="类目" />
        <el-table-column prop="amount" label="金额">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="transaction_date" label="日期" width="120" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getPartners, getPartner, createPartner, updatePartner, deletePartner } from '../api/partners'

const searchForm = reactive({ type: '', keyword: '' })
const tableData = ref([])
const dialogVisible = ref(false)
const detailVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const detail = ref({})

const typeMap = { customer: '客户', supplier: '供应商', both: '其他' }

const form = reactive({
  id: null,
  name: '',
  type: 'customer',
  contact: '',
  phone: '',
  address: '',
  initialDebt: 0,
  status: 1
})

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }]
}

const formatMoney = (value) => '¥' + (value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const loadData = async () => {
  tableData.value = await getPartners(searchForm)
}

const resetSearch = () => {
  searchForm.type = ''
  searchForm.keyword = ''
  loadData()
}

const handleAdd = () => {
  isEdit.value = false
  form.id = null
  form.name = ''
  form.type = 'customer'
  form.contact = ''
  form.phone = ''
  form.address = ''
  form.initialDebt = 0
  form.status = 1
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  form.id = row.id
  form.name = row.name
  form.type = row.type
  form.contact = row.contact
  form.phone = row.phone
  form.address = row.address
  form.initialDebt = row.initial_debt
  form.status = row.status
  dialogVisible.value = true
}

const handleView = async (row) => {
  detail.value = await getPartner(row.id)
  detailVisible.value = true
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm('确定要删除该往来单位吗？', '提示', { type: 'warning' })
  await deletePartner(row.id)
  ElMessage.success('删除成功')
  loadData()
}

const submitForm = async () => {
  await formRef.value.validate()
  const data = {
    name: form.name,
    type: form.type,
    contact: form.contact,
    phone: form.phone,
    address: form.address,
    initialDebt: form.initialDebt,
    status: form.status
  }
  if (isEdit.value) {
    await updatePartner(form.id, data)
    ElMessage.success('更新成功')
  } else {
    await createPartner(data)
    ElMessage.success('添加成功')
  }
  dialogVisible.value = false
  loadData()
}

onMounted(() => {
  loadData()
})
</script>
