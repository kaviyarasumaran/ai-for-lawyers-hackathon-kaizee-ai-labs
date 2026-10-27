import CaseworkPageLayout from '../../components/casework-tools/CaseworkPageLayout'
import CaseworkToolWorkspace from '../../components/casework-tools/CaseworkToolWorkspace'
import { caseworkTools } from '../../casework-tools/tools'

function SummarizeCaseFilesPage() {
  const tool = caseworkTools.find((item) => item.id === 'file-summaries')
  return (
    <CaseworkPageLayout tool={tool}>
      <CaseworkToolWorkspace tool={tool} />
    </CaseworkPageLayout>
  )
}

export default SummarizeCaseFilesPage
