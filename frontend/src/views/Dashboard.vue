<template>
  <div>
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="label">本月收入</div>
          <div class="value income">{{ formatMoney(summary.income) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="label">本月支出</div>
          <div class="value expense">{{ formatMoney(summary.expense) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="label">本月利润</div>
          <div class="value profit">{{ formatMoney(summary.profit) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="label">应收账款</div>
          <div class="value">{{ formatMoney(receivableSummary.receivableTotal) }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>收支趋势（近12个月）</span>
            </div>
          </template>
          <div ref="trendChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>支出类目占比</span>
            </div>
          </template>
          <div ref="categoryChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>逾期提醒</span>
            </div>
          </template>
          <el-table :data="overdueList" max-height="300">
            <el-table-column prop="partner_name" label="往来单位" />
            <el-table-column prop="type" label="类型">
              <template #default="{ row }">
                {{ row.type === 'receivable' ? '应收' : '应付' }}
              </template>
            </el-table-column>
            <el-table-column label="金额">
              <template #default="{ row }">
                {{ formatMoney(row.amount - row.paid_amount) }}
              </template>
            </el-table-column>
            <el-table-column prop="due_date" label="到期日期" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>预算预警</span>
            </div>
          </template>
          <el-table :data="budgetAlerts" max-height="300">
            <el-table-column prop="category_name" label="类目" />
            <el-table-column label="预算">
              <template #default="{ row }">
                {{ formatMoney(row.amount) }}
              </template>
            </el-table-column>
            <el-table-column label="已用">
              <template #default="{ row }">
                {{ formatMoney(row.used_amount) }}
              </template>
            </el-table-column>
            <el-table-column label="使用率">
              <template #default="{ row }">
                <el-progress :percentage="row.percentage" :status="row.percentage >= 100 ? 'exception' : row.percentage >= 80 ? 'warning' : ''" />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { getReportSummary, getReportMonthly, getReportByCategory } from '../api/reports'
import { getReceivables, getReceivablesSummary } from '../api/receivables'
import { getBudgetStatus } from '../api/budgets'

const trendChartRef = ref()
const categoryChartRef = ref()
const summary = ref({ income: 0, expense: 0, profit: 0 })
const receivableSummary = ref({ receivableTotal: 0, payableTotal: 0 })
const overdueList = ref([])
const budgetAlerts = ref([])

const formatMoney = (value) => {
  return '¥' + (value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const initTrendChart = (data) => {
  const chart = echarts.init(trendChartRef.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '支出'] },
    xAxis: { type: 'category', data: data.map(d => d.month + '月') },
    yAxis: { type: 'value' },
    series: [
      { name: '收入', type: 'line', data: data.map(d => d.income), smooth: true },
      { name: '支出', type: 'line', data: data.map(d => d.expense), smooth: true }
    ]
  })
}

const initCategoryChart = (data) => {
  const chart = echarts.init(categoryChartRef.value)
  chart.setOption({
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [{
      type: 'pie',
      radius: '50%',
      data: data.filter(d => d.type === 'expense' && d.total > 0).map(d => ({ name: d.name, value: d.total })),
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
    }]
  })
}

onMounted(async () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [summaryRes, monthlyRes, categoryRes, receivableRes, overdueRes, budgetRes] = await Promise.all([
    getReportSummary({ year, month }),
    getReportMonthly({ year }),
    getReportByCategory({ year, month }),
    getReceivablesSummary(),
    getReceivables({ overdue: 'true' }),
    getBudgetStatus({ year, month })
  ])

  summary.value = summaryRes
  receivableSummary.value = receivableRes
  overdueList.value = overdueRes
  budgetAlerts.value = budgetRes.alerts

  await nextTick()
  initTrendChart(monthlyRes)
  initCategoryChart(categoryRes)
})
</script>
