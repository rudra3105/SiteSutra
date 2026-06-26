import { notFound } from 'next/navigation'
import { getCashbookById, getParties, getCustomPaymentMethods } from '@/actions/cashbook'
import { getSiteById } from '@/actions/sites'
import { BookAccessView } from '@/components/charts/BookAccessView'

export default async function BookAccessPage({ params }: { params: { cashbookId: string } }) {
  const book = await getCashbookById(params.cashbookId)
  if (!book) notFound()

  const [parties, customPaymentMethods, site] = await Promise.all([
    getParties(book.id),
    getCustomPaymentMethods(book.siteId),
    getSiteById(book.siteId),
  ])

  return (
    <BookAccessView
      book={book}
      siteName={site?.name ?? ''}
      initialParties={parties}
      initialCustomPaymentMethods={customPaymentMethods}
    />
  )
}
