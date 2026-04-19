export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__col">
        <div className="footer__mark">Budget Buckets</div>
        <p>
          A public ledger of municipal spending, assembled from official budget
          documents by an autonomous Pi agent and grouped into nine civic
          buckets for legibility.
        </p>
      </div>
      <div className="footer__col">
        <h4>How it works</h4>
        <p>
          Search a city → we check the cache → if not there, the Pi agent
          browses the city's official budget site, extracts the numbers, maps
          them to buckets, and stores the result for next time.
        </p>
      </div>
      <div className="footer__col">
        <h4>Transparency</h4>
        <p>
          Every figure links back to a cited source. Disagree with the bucket
          mapping? That's fair — this is a journalistic tool, not the
          accounting of record.
        </p>
      </div>
    </footer>
  )
}
