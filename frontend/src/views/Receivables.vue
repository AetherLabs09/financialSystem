<template>
  <div>
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="label">应收账款</div>
          <div class="value income">{{ formatMoney(summary.receivableTotal) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="label">应付账款</div>
          <div class="value expense">{{ formatMoney(summary.payableTotal) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="label">逾期应收</div>
          <div class="value">{{ summary.overdueReceivables }}笔 / {{ formatMoney(summary.overdueReceivableAmount) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="label">逾期应付</div>
          <div class="value">{{ summary.overduePayables }}笔 / {{ formatMoney(summary.overduePayableAmount) }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <template #header>
        <div class="card-header">
          <el-radio-group v-model="activeType" @change="loadData">
            <el-radio-button value="receivable">应收账款</el-radio-button>
            <el-radio-button value="payable">应付账款</el-radio-button>
          </el-radio-group>
          <el-button type="primary" @click="handleAdd">新增</el-button>
        </div>
      </template>
      <el-table :data="tableData" stripe>
        <el-table-column prop="partner_name" label="往来单位" width="200" />
        <el-table-column prop="amount" label="总金额" width="120">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="paid_amount" label="已收/付" width="120">
          <template #default="{ row }">{{ formatMoney(row.paid_amount) }}</template>
        </el-table-column>
        <el-table-column label="待收/付" width="120">
          <template #default="{ row }">
            <span class="expense">{{ formatMoney(row.amount - row.paid_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="due_date" label="到期日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.status]?.type">{{ statusMap[row.status]?.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" show-overflow-tooltip />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" link @click="handlePay(row)" v-if="row.status !== 'settled'">收款/付款</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="新增应收/应付" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio value="receivable">应收</el-radio>
            <el-radio value="payable">应付</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="往来单位" prop="partnerId">
          <el-select v-model="form.partnerId" filterable placeholder="请选择">
            <el-option v-for="p in partners" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="到期日期">
          <el-date-picker v-model="form.dueDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="payDialogVisible" title="收款/付款" width="400px">
      <el-form :model="payForm" :rules="payRules" ref="payFormRef" label-width="80px">
        <el-form-item label="待收/付">
          {{ formatMoney(currentItem?.amount - currentItem?.paid_amount) }}
        </el-form-item>
        <el-form-item label="本次金额" prop="paidAmount">
          <el-input-number v-model="payForm.paidAmount" :min="0" :max="currentItem?.amount - currentItem?.paid_amount" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="payForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="payDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPay">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getReceivables, getReceivablesSummary, createReceivable, updateReceivable, deleteReceivable } from '../api/receivables'
import { getPartners } from '../api/partners'

const activeType = ref('receivable')
const tableData = ref([])
const summary = ref({})
const partners = ref([])
const dialogVisible = ref(false)
const payDialogVisible = ref(false)
const formRef = ref()
const payFormRef = ref()
const currentItem = ref(null)

const statusMap = {
  pending: { label: '待处理', type: 'warning' },
  partial: { label: '部分结清', type: 'primary' },
  settled: { label: '已结清', type: 'success' }
}

const form = reactive({
  type: 'receivable',
  partnerId: '',
  amount: 0,
  dueDate: '',
  remark: ''
})

const payForm = reactive({
  paidAmount: 0,
  remark: ''
})

const rules = {
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  partnerId: [{ required: true, message: '请选择往来单位', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }]
}

const payRules = {
  paidAmount: [{ required: true, message: '请输入金额', trigger: 'blur' }]
}

const formatMoney = (value) => '¥' + (value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const loadData = async () => {
  tableData.value = await getReceivables({ type: activeType.value })
}

const loadSummary = async () => {
  summary.value = await getReceivablesSummary()
}

const loadPartners = async () => {
  partners.value = await getPartners({})
}

const handleAdd = () => {
  form.type = activeType.value
  form.partnerId = ''
  form.amount = 0
  form.dueDate = ''
  form.remark = ''
  dialogVisible.value = true
}

const handlePay = (row) => {
  currentItem.value = row
  payForm.paidAmount = 0
  payForm.remark = ''
  payDialogVisible.value = true
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm('确定要删除该记录吗？', '提示', { type: 'warning' })
  await deleteReceivable(row.id)
  ElMessage.success('删除成功')
  loadData()
  loadSummary()
}

const submitForm = async () => {
  await formRef.value.validate()
  await createReceivable({
    type: form.type,
    partnerId: form.partnerId,
    amount: form.amount,
    dueDate: form.dueDate,
    remark: form.remark
  })
  ElMessage.success('添加成功')
  dialogVisible.value = false
  loadData()
  loadSummary()
}

const submitPay = async () => {
  await payFormRef.value.validate()
  await updateReceivable(currentItem.value.id, {
    paidAmount: payForm.paidAmount,
    remark: payForm.remark
  })
  ElMessage.success('操作成功')
  payDialogVisible.value = false
  loadData()
  loadSummary()
}

onMounted(() => {
  loadData()
  loadSummary()
  loadPartners()
})
</script>
